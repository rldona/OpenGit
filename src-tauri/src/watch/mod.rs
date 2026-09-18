//! Vigilancia de `.git` (OG-010): debounce de 250 ms, clasificación por tipo,
//! pausa durante operaciones propias y fallback por polling lento.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

use notify::{EventKind, RecursiveMode, Watcher};
use serde::Serialize;

use crate::git::error::GitError;

const DEBOUNCE: Duration = Duration::from_millis(250);
const POLL_FALLBACK: Duration = Duration::from_secs(5);

const REF_FILES: [&str; 8] = [
    "HEAD",
    "packed-refs",
    "ORIG_HEAD",
    "MERGE_HEAD",
    "FETCH_HEAD",
    "CHERRY_PICK_HEAD",
    "REBASE_HEAD",
    "BISECT_HEAD",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RepoEventKind {
    RefsChanged,
    IndexChanged,
    WorktreeChanged,
    Refreshed,
}

impl RepoEventKind {
    pub fn event_name(self) -> &'static str {
        match self {
            Self::RefsChanged => "repo://refs-changed",
            Self::IndexChanged => "repo://index-changed",
            Self::WorktreeChanged => "repo://worktree-changed",
            Self::Refreshed => "repo://refreshed",
        }
    }

    fn bit(self) -> u8 {
        match self {
            Self::RefsChanged => 1,
            Self::IndexChanged => 2,
            Self::WorktreeChanged => 4,
            Self::Refreshed => 8,
        }
    }
}

/// Clasifica una ruta tocada en `.git` en su evento.
pub fn classify(path: &Path) -> RepoEventKind {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    if name == "index" {
        return RepoEventKind::IndexChanged;
    }
    if REF_FILES.contains(&name) || path.components().any(|c| c.as_os_str() == "refs") {
        return RepoEventKind::RefsChanged;
    }
    RepoEventKind::WorktreeChanged
}

/// Acumula varios eventos en una ventana de debounce y los entrega una sola
/// vez por tipo.
#[derive(Debug, Default)]
struct Pending(u8);

impl Pending {
    fn add(&mut self, kind: RepoEventKind) {
        self.0 |= kind.bit();
    }

    fn is_empty(&self) -> bool {
        self.0 == 0
    }

    fn take(&mut self) -> Vec<RepoEventKind> {
        let mask = std::mem::take(&mut self.0);
        [
            RepoEventKind::RefsChanged,
            RepoEventKind::IndexChanged,
            RepoEventKind::WorktreeChanged,
            RepoEventKind::Refreshed,
        ]
        .into_iter()
        .filter(|kind| mask & kind.bit() != 0)
        .collect()
    }
}

pub struct WatcherHandle {
    stop: Arc<AtomicBool>,
    paused: Arc<AtomicUsize>,
    dirty: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
    emit: Arc<dyn Fn(RepoEventKind) + Send + Sync>,
}

impl WatcherHandle {
    /// Silencia los eventos mientras la app opera sobre el repo.
    pub fn pause(&self) {
        self.paused.fetch_add(1, Ordering::SeqCst);
    }

    /// Reanuda y, si hubo cambios durante la pausa, emite un único refresco.
    pub fn resume(&self) {
        let previous = self
            .paused
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |value| {
                value.checked_sub(1)
            })
            .unwrap_or(0);
        if previous == 1 && self.dirty.swap(false, Ordering::SeqCst) {
            (self.emit)(RepoEventKind::Refreshed);
        }
    }

    pub fn stop(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

/// Arranca la vigilancia de `.git`. Si el SO no entrega eventos, cae a polling.
pub fn start<F>(repo_root: PathBuf, emit: F) -> Result<WatcherHandle, GitError>
where
    F: Fn(RepoEventKind) + Send + Sync + 'static,
{
    let git_dir = repo_root.join(".git");
    let (sender, receiver) = mpsc::channel::<PathBuf>();
    let stop = Arc::new(AtomicBool::new(false));
    let paused = Arc::new(AtomicUsize::new(0));
    let dirty = Arc::new(AtomicBool::new(false));
    let emit: Arc<dyn Fn(RepoEventKind) + Send + Sync> = Arc::new(emit);

    let thread = {
        let stop = Arc::clone(&stop);
        let paused = Arc::clone(&paused);
        let dirty = Arc::clone(&dirty);
        let emit = Arc::clone(&emit);
        thread::spawn(move || {
            let watcher =
                notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
                    if let Ok(event) = result {
                        if matches!(event.kind, EventKind::Access(_)) {
                            return;
                        }
                        for path in event.paths {
                            let _ = sender.send(path);
                        }
                    }
                });
            let mut watcher = match watcher {
                Ok(watcher) => watcher,
                Err(_) => {
                    poll_loop(&stop, &paused, &dirty, &emit);
                    return;
                }
            };
            if watcher.watch(&git_dir, RecursiveMode::Recursive).is_err() {
                poll_loop(&stop, &paused, &dirty, &emit);
                return;
            }

            let mut pending = Pending::default();
            while !stop.load(Ordering::SeqCst) {
                match receiver.recv_timeout(DEBOUNCE) {
                    Ok(path) => pending.add(classify(&path)),
                    Err(RecvTimeoutError::Timeout) => {
                        if !pending.is_empty() {
                            for kind in pending.take() {
                                if paused.load(Ordering::SeqCst) > 0 {
                                    dirty.store(true, Ordering::SeqCst);
                                } else {
                                    emit(kind);
                                }
                            }
                        }
                    }
                    Err(RecvTimeoutError::Disconnected) => break,
                }
            }
            drop(watcher);
        })
    };

    Ok(WatcherHandle {
        stop,
        paused,
        dirty,
        thread: Some(thread),
        emit,
    })
}

fn poll_loop(
    stop: &AtomicBool,
    paused: &AtomicUsize,
    dirty: &AtomicBool,
    emit: &Arc<dyn Fn(RepoEventKind) + Send + Sync>,
) {
    while !stop.load(Ordering::SeqCst) {
        thread::sleep(POLL_FALLBACK);
        if stop.load(Ordering::SeqCst) {
            return;
        }
        if paused.load(Ordering::SeqCst) > 0 {
            dirty.store(true, Ordering::SeqCst);
        } else {
            emit(RepoEventKind::Refreshed);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clasifica_index_refs_y_resto() {
        assert_eq!(
            classify(Path::new("/repo/.git/index")),
            RepoEventKind::IndexChanged
        );
        assert_eq!(
            classify(Path::new("/repo/.git/HEAD")),
            RepoEventKind::RefsChanged
        );
        assert_eq!(
            classify(Path::new("/repo/.git/refs/heads/main")),
            RepoEventKind::RefsChanged
        );
        assert_eq!(
            classify(Path::new("/repo/.git/packed-refs")),
            RepoEventKind::RefsChanged
        );
        assert_eq!(
            classify(Path::new("/repo/.git/COMMIT_EDITMSG")),
            RepoEventKind::WorktreeChanged
        );
    }

    #[test]
    fn diez_eventos_del_index_se_agrupan_en_uno() {
        let mut pending = Pending::default();
        for _ in 0..10 {
            pending.add(RepoEventKind::IndexChanged);
        }
        assert_eq!(pending.take(), vec![RepoEventKind::IndexChanged]);
        assert!(pending.is_empty());
    }

    #[test]
    fn agrupa_varios_tipos_en_orden() {
        let mut pending = Pending::default();
        pending.add(RepoEventKind::WorktreeChanged);
        pending.add(RepoEventKind::RefsChanged);
        pending.add(RepoEventKind::IndexChanged);
        assert_eq!(
            pending.take(),
            vec![
                RepoEventKind::RefsChanged,
                RepoEventKind::IndexChanged,
                RepoEventKind::WorktreeChanged
            ]
        );
    }

    #[test]
    fn la_pausa_retiene_y_reanuda_con_un_solo_refresco() {
        let (sender, receiver) = mpsc::channel();
        let handle = WatcherHandle {
            stop: Arc::new(AtomicBool::new(false)),
            paused: Arc::new(AtomicUsize::new(0)),
            dirty: Arc::new(AtomicBool::new(false)),
            thread: None,
            emit: Arc::new(move |kind| {
                let _ = sender.send(kind);
            }),
        };

        handle.pause();
        handle.dirty.store(true, Ordering::SeqCst);
        assert!(receiver.try_recv().is_err());

        handle.resume();
        assert_eq!(receiver.try_recv().unwrap(), RepoEventKind::Refreshed);
        assert!(receiver.try_recv().is_err());
    }
}
