//! Repository watching (OG-010, OG-080): recursive watch over the working
//! tree and `.git`, 250 ms debounce, classification by kind, git-ignore
//! filtering of working-tree paths, pause during our own operations and a
//! slow polling fallback.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Condvar, Mutex, RwLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use notify::{EventKind, RecursiveMode, Watcher};
use serde::Serialize;

use crate::git::runner::{GitCommand, Runner};

const DEBOUNCE: Duration = Duration::from_millis(250);
const POLL_FALLBACK: Duration = Duration::from_secs(5);
/// How often the ignore set is rebuilt while worktree changes keep arriving,
/// to pick up directories created after the watcher started.
const IGNORE_REFRESH: Duration = Duration::from_secs(2);

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

/// Classifies a path touched inside `.git` into its event.
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

/// Classifies an event path: `.git` internals keep their rules, git-ignored
/// working-tree paths are dropped and everything else is a worktree change.
fn classify_path(path: &Path, git_dir: &Path, ignored: &IgnoreMatcher) -> Option<RepoEventKind> {
    if path.starts_with(git_dir) {
        Some(classify(path))
    } else if ignored.is_ignored(path) {
        None
    } else {
        Some(RepoEventKind::WorktreeChanged)
    }
}

/// Paths ignored by git, so build directories do not flood the UI with
/// refreshes. Rebuilt from `git ls-files` on start and when `.gitignore`
/// changes.
#[derive(Debug, Default)]
struct IgnoreMatcher {
    root: PathBuf,
    ignored: HashSet<PathBuf>,
}

impl IgnoreMatcher {
    fn new(root: &Path) -> Self {
        Self {
            root: root.to_path_buf(),
            ignored: HashSet::new(),
        }
    }

    fn refresh(&mut self, runner: &Runner) {
        let command = GitCommand::new([
            "ls-files",
            "-o",
            "-i",
            "--exclude-standard",
            "--directory",
            "-z",
        ])
        .cwd(&self.root);
        let Ok(output) = runner.run(&command) else {
            return;
        };
        if !output.success() {
            return;
        }
        // `--directory` collapses fully ignored directories, so both ignored
        // files and ignored directories (at any depth) come in one batch.
        let mut ignored = HashSet::new();
        for record in output.stdout.split(|byte| *byte == 0) {
            if record.is_empty() {
                continue;
            }
            let text = String::from_utf8_lossy(record);
            let relative = text.trim_end_matches(['/', '\\']);
            if relative.is_empty() {
                continue;
            }
            ignored.insert(self.root.join(relative));
        }
        self.ignored = ignored;
    }

    /// Checks the path and its ancestors, so descendants of an ignored
    /// directory are ignored too (`node_modules/a/b.js`).
    fn is_ignored(&self, path: &Path) -> bool {
        let mut current = Some(path);
        while let Some(candidate) = current {
            if self.ignored.contains(candidate) {
                return true;
            }
            if candidate == self.root {
                break;
            }
            current = candidate.parent();
        }
        false
    }
}

/// Accumulates several events inside a debounce window and delivers them only
/// once per kind.
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

/// Message sent from the notify callback to the debounce loop.
enum WatchMessage {
    Kind(RepoEventKind),
    IgnoreChanged,
}

/// Signals when the OS watch is registered, so `start` can return without
/// waiting for the setup (git ignore load included) to finish (ADR-0010).
#[derive(Default)]
struct Readiness {
    ready: Mutex<bool>,
    cv: Condvar,
}

impl Readiness {
    fn signal(&self) {
        if let Ok(mut ready) = self.ready.lock() {
            *ready = true;
            self.cv.notify_all();
        }
    }

    fn wait(&self, timeout: Duration) -> bool {
        let Ok(ready) = self.ready.lock() else {
            return false;
        };
        self.cv
            .wait_timeout_while(ready, timeout, |ready| !*ready)
            .map(|(guard, _)| *guard)
            .unwrap_or(false)
    }
}

pub struct WatcherHandle {
    stop: Arc<AtomicBool>,
    paused: Arc<AtomicUsize>,
    dirty: Arc<AtomicBool>,
    ready: Arc<Readiness>,
    thread: Option<JoinHandle<()>>,
    emit: Arc<dyn Fn(RepoEventKind) + Send + Sync>,
}

impl WatcherHandle {
    /// Silences events while the app operates on the repo.
    pub fn pause(&self) {
        self.paused.fetch_add(1, Ordering::SeqCst);
    }

    /// Resumes and, if there were changes during the pause, emits a single refresh.
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

    /// Waits until the OS watch is registered, or `timeout` elapses.
    pub fn wait_ready(&self, timeout: Duration) -> bool {
        self.ready.wait(timeout)
    }

    pub fn stop(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }

    /// Stops the watcher without blocking the caller: used when swapping a
    /// window's watcher so the command thread is not joined on.
    pub fn stop_detached(self) {
        std::thread::spawn(move || self.stop());
    }
}

/// Starts watching the working tree and `.git`. If the OS does not deliver
/// events, it falls back to polling. It returns immediately; the OS watch is
/// registered asynchronously (see [`WatcherHandle::wait_ready`]).
pub fn start<F>(runner: Runner, repo_root: PathBuf, emit: F) -> WatcherHandle
where
    F: Fn(RepoEventKind) + Send + Sync + 'static,
{
    // notify reports real paths (macOS resolves `/var` to `/private/var`), so
    // the prefix checks below need the canonical root.
    let repo_root = repo_root.canonicalize().unwrap_or(repo_root);
    let git_dir = repo_root.join(".git");
    let (sender, receiver) = mpsc::channel::<WatchMessage>();
    let stop = Arc::new(AtomicBool::new(false));
    let paused = Arc::new(AtomicUsize::new(0));
    let dirty = Arc::new(AtomicBool::new(false));
    let ready = Arc::new(Readiness::default());
    let emit: Arc<dyn Fn(RepoEventKind) + Send + Sync> = Arc::new(emit);

    let thread = {
        let stop = Arc::clone(&stop);
        let paused = Arc::clone(&paused);
        let dirty = Arc::clone(&dirty);
        let ready = Arc::clone(&ready);
        let emit = Arc::clone(&emit);
        thread::spawn(move || {
            // The ignore set starts empty and without git, so the OS watch is
            // registered before the slow `git ls-files` runs.
            let ignored = Arc::new(RwLock::new(IgnoreMatcher::new(&repo_root)));
            let callback_git_dir = git_dir.clone();
            let callback_ignored = Arc::clone(&ignored);
            let watcher =
                notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
                    let Ok(event) = result else {
                        return;
                    };
                    if matches!(event.kind, EventKind::Access(_)) {
                        return;
                    }
                    let matcher = callback_ignored
                        .read()
                        .unwrap_or_else(|poisoned| poisoned.into_inner());
                    for path in event.paths {
                        let Some(kind) = classify_path(&path, &callback_git_dir, &matcher) else {
                            continue;
                        };
                        let _ = sender.send(WatchMessage::Kind(kind));
                        if is_ignore_file(&path) {
                            let _ = sender.send(WatchMessage::IgnoreChanged);
                        }
                    }
                });
            let mut watcher = match watcher {
                Ok(watcher) => watcher,
                Err(_) => {
                    ready.signal();
                    poll_loop(&stop, &paused, &dirty, &emit);
                    return;
                }
            };
            // A single recursive root: on macOS it is one FSEvents stream and
            // the ignore filter is applied per event, so we do not pay for
            // restarting the stream once per directory.
            if watcher.watch(&repo_root, RecursiveMode::Recursive).is_err() {
                ready.signal();
                poll_loop(&stop, &paused, &dirty, &emit);
                return;
            }
            if stop.load(Ordering::SeqCst) {
                ready.signal();
                return;
            }
            refresh_ignored(&ignored, &runner);
            if stop.load(Ordering::SeqCst) {
                ready.signal();
                return;
            }
            ready.signal();

            let mut pending = Pending::default();
            let mut last_ignore_refresh = Instant::now();
            while !stop.load(Ordering::SeqCst) {
                match receiver.recv_timeout(DEBOUNCE) {
                    Ok(WatchMessage::Kind(RepoEventKind::WorktreeChanged)) => {
                        pending.add(RepoEventKind::WorktreeChanged);
                        // A directory ignored by `.gitignore` may not exist yet
                        // when the set is loaded (a build creating it later), so
                        // refresh it periodically while changes keep arriving.
                        if last_ignore_refresh.elapsed() >= IGNORE_REFRESH {
                            last_ignore_refresh = Instant::now();
                            refresh_ignored(&ignored, &runner);
                        }
                    }
                    Ok(WatchMessage::Kind(kind)) => pending.add(kind),
                    Ok(WatchMessage::IgnoreChanged) => {
                        last_ignore_refresh = Instant::now();
                        refresh_ignored(&ignored, &runner);
                    }
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

    WatcherHandle {
        stop,
        paused,
        dirty,
        ready,
        thread: Some(thread),
        emit,
    }
}

fn is_ignore_file(path: &Path) -> bool {
    matches!(
        path.file_name().and_then(|name| name.to_str()),
        Some(".gitignore") | Some("exclude")
    )
}

fn refresh_ignored(ignored: &RwLock<IgnoreMatcher>, runner: &Runner) {
    let mut matcher = ignored
        .write()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    matcher.refresh(runner);
}

/// Sleeps in small chunks so a stop request is noticed promptly.
fn sleep_interruptible(stop: &AtomicBool, total: Duration) {
    const CHUNK: Duration = Duration::from_millis(100);
    let mut remaining = total;
    while remaining > Duration::ZERO && !stop.load(Ordering::SeqCst) {
        let step = remaining.min(CHUNK);
        thread::sleep(step);
        remaining = remaining.saturating_sub(step);
    }
}

fn poll_loop(
    stop: &AtomicBool,
    paused: &AtomicUsize,
    dirty: &AtomicBool,
    emit: &Arc<dyn Fn(RepoEventKind) + Send + Sync>,
) {
    while !stop.load(Ordering::SeqCst) {
        sleep_interruptible(stop, POLL_FALLBACK);
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
    fn clasifica_eventos_de_git_ignorados_y_worktree() {
        let matcher = IgnoreMatcher {
            root: PathBuf::from("/repo"),
            ignored: HashSet::from([PathBuf::from("/repo/node_modules")]),
        };
        let git_dir = Path::new("/repo/.git");

        assert_eq!(
            classify_path(Path::new("/repo/.git/index"), git_dir, &matcher),
            Some(RepoEventKind::IndexChanged)
        );
        assert_eq!(
            classify_path(Path::new("/repo/src/main.rs"), git_dir, &matcher),
            Some(RepoEventKind::WorktreeChanged)
        );
        assert_eq!(
            classify_path(Path::new("/repo/node_modules/a/b.js"), git_dir, &matcher),
            None
        );
    }

    #[test]
    fn el_matcher_ignora_ficheros_y_descendientes() {
        let matcher = IgnoreMatcher {
            root: PathBuf::from("/repo"),
            ignored: HashSet::from([
                PathBuf::from("/repo/node_modules"),
                PathBuf::from("/repo/.DS_Store"),
            ]),
        };

        assert!(matcher.is_ignored(Path::new("/repo/node_modules/pkg/index.js")));
        assert!(matcher.is_ignored(Path::new("/repo/.DS_Store")));
        assert!(!matcher.is_ignored(Path::new("/repo/.DS_Store.bak")));
        assert!(!matcher.is_ignored(Path::new("/repo/src/lib.rs")));
        assert!(!matcher.is_ignored(Path::new("/repo")));
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
            ready: Arc::new(Readiness::default()),
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

    #[test]
    fn readiness_wait_returns_true_after_signal() {
        let ready = Readiness::default();
        ready.signal();
        assert!(ready.wait(Duration::from_millis(50)));
    }

    #[test]
    fn readiness_wait_times_out_without_signal() {
        let ready = Readiness::default();
        assert!(!ready.wait(Duration::from_millis(20)));
    }

    #[test]
    fn readiness_late_signal_wakes_a_waiting_thread() {
        let ready = Arc::new(Readiness::default());
        let waiter = {
            let ready = Arc::clone(&ready);
            thread::spawn(move || ready.wait(Duration::from_secs(5)))
        };
        thread::sleep(Duration::from_millis(20));
        ready.signal();
        assert!(waiter.join().unwrap());
    }

    #[test]
    fn sleep_interruptible_wakes_on_stop_before_the_full_wait() {
        let stop = Arc::new(AtomicBool::new(false));
        let stopper = {
            let stop = Arc::clone(&stop);
            thread::spawn(move || {
                thread::sleep(Duration::from_millis(20));
                stop.store(true, Ordering::SeqCst);
            })
        };
        let start = Instant::now();
        sleep_interruptible(&stop, POLL_FALLBACK);
        let elapsed = start.elapsed();
        stopper.join().unwrap();
        assert!(elapsed < POLL_FALLBACK);
    }
}
