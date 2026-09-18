use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, State};

use crate::git::{error::GitError, runner::Runner, version::GitVersion, Commit, Ref, StatusReport};
use crate::repo::{self, ops, recents::Recents, RecentRepo};
use crate::watch::{self, WatcherHandle};

/// Estado compartido por los comandos: runner de git, recientes y watcher.
pub struct AppState {
    pub runner: Runner,
    pub recents: Mutex<Recents>,
    pub watcher: Mutex<Option<WatcherHandle>>,
}

impl AppState {
    fn pause_watcher(&self) {
        if let Ok(watcher) = self.watcher.lock() {
            if let Some(watcher) = watcher.as_ref() {
                watcher.pause();
            }
        }
    }

    fn resume_watcher(&self) {
        if let Ok(watcher) = self.watcher.lock() {
            if let Some(watcher) = watcher.as_ref() {
                watcher.resume();
            }
        }
    }
}

/// Ejecuta una operación propia silenciando el watcher y emitiendo, como mucho,
/// un refresco al terminar.
fn pause_while<T>(state: &AppState, action: impl FnOnce() -> T) -> T {
    state.pause_watcher();
    let result = action();
    state.resume_watcher();
    result
}

#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn git_version(state: State<'_, AppState>) -> Result<GitVersion, GitError> {
    state.runner.version()
}

/// Valida la carpeta, devuelve la info del repo, lo añade a recientes y
/// arranca la vigilancia de `.git` (parando la anterior).
#[tauri::command]
pub fn open_repo(
    app: AppHandle,
    path: String,
    state: State<'_, AppState>,
) -> Result<repo::RepoInfo, GitError> {
    let info = repo::open(&state.runner, Path::new(&path))?;
    let recent = RecentRepo {
        path: info.root.clone(),
        name: info.name.clone(),
        opened_at: now(),
    };
    state.recents.lock().map_err(lock_error)?.add(&recent)?;

    let event_root = info.root.clone();
    let mut guard = state.watcher.lock().map_err(lock_error)?;
    if let Some(previous) = guard.take() {
        previous.stop();
    }
    if let Ok(handle) = watch::start(PathBuf::from(&info.root), move |kind| {
        let _ = app.emit(kind.event_name(), event_root.clone());
    }) {
        *guard = Some(handle);
    }
    Ok(info)
}

#[tauri::command]
pub fn close_repo(state: State<'_, AppState>) -> Result<(), GitError> {
    if let Some(watcher) = state.watcher.lock().map_err(lock_error)?.take() {
        watcher.stop();
    }
    Ok(())
}

#[tauri::command]
pub fn log_page(
    path: String,
    skip: usize,
    limit: usize,
    rev: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Commit>, GitError> {
    crate::git::log_page(&state.runner, Path::new(&path), skip, limit, rev.as_deref())
}

#[tauri::command]
pub fn list_refs(path: String, state: State<'_, AppState>) -> Result<Vec<Ref>, GitError> {
    crate::git::refs(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn status_repo(path: String, state: State<'_, AppState>) -> Result<StatusReport, GitError> {
    crate::git::status(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn stage_path(
    path: String,
    file: String,
    orig_file: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    let mut files = vec![file];
    if let Some(orig) = orig_file {
        files.push(orig);
    }
    let file_refs: Vec<&str> = files.iter().map(String::as_str).collect();
    pause_while(&state, || {
        ops::stage_paths(&state.runner, Path::new(&path), &file_refs)
    })
}

#[tauri::command]
pub fn unstage_path(
    path: String,
    file: String,
    orig_file: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    let mut files = vec![file];
    if let Some(orig) = orig_file {
        files.push(orig);
    }
    let file_refs: Vec<&str> = files.iter().map(String::as_str).collect();
    pause_while(&state, || {
        ops::unstage_paths(&state.runner, Path::new(&path), &file_refs)
    })
}

/// Destructivo: la UI debe confirmarlo antes de invocarlo.
#[tauri::command]
pub fn discard_path(
    path: String,
    file: String,
    orig_file: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    let mut files = vec![file];
    if let Some(orig) = orig_file {
        files.push(orig);
    }
    let file_refs: Vec<&str> = files.iter().map(String::as_str).collect();
    pause_while(&state, || {
        ops::discard_paths(&state.runner, Path::new(&path), &file_refs)
    })
}

/// Stage/unstage parcial por hunk o por líneas (OG-006).
#[tauri::command]
pub fn stage_selection(
    path: String,
    file: String,
    staged: bool,
    selection: crate::git::patch::HunkSelection,
    reverse: bool,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::stage_selection(
            &state.runner,
            Path::new(&path),
            &file,
            staged,
            &selection,
            reverse,
        )
    })
}

/// Destructivo: borra un fichero sin trackear (confirmado antes en la UI).
#[tauri::command]
pub fn delete_untracked(
    path: String,
    file: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || ops::remove_untracked(Path::new(&path), &file))
}

#[tauri::command]
pub fn diff_file(
    path: String,
    file: String,
    staged: bool,
    rev: Option<String>,
    reversed: bool,
    state: State<'_, AppState>,
) -> Result<String, GitError> {
    match rev {
        Some(rev) => {
            crate::git::commit_file_diff(&state.runner, Path::new(&path), &rev, &file, reversed)
        }
        None => {
            crate::git::worktree_file_diff(&state.runner, Path::new(&path), &file, staged, reversed)
        }
    }
}

#[tauri::command]
pub fn commit_files(
    path: String,
    rev: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::git::FileDiff>, GitError> {
    crate::git::commit_files(&state.runner, Path::new(&path), &rev)
}

#[tauri::command]
pub fn diff_numstat(
    path: String,
    cached: bool,
    state: State<'_, AppState>,
) -> Result<Vec<crate::git::FileDiff>, GitError> {
    crate::git::diff_numstat(&state.runner, Path::new(&path), cached)
}

#[tauri::command]
pub fn commit_message(path: String, state: State<'_, AppState>) -> Result<String, GitError> {
    crate::git::last_commit_message(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn commit_repo(
    path: String,
    message: String,
    amend: bool,
    state: State<'_, AppState>,
) -> Result<crate::git::CommitResult, GitError> {
    pause_while(&state, || {
        crate::git::commit(&state.runner, Path::new(&path), &message, amend)
    })
}

#[tauri::command]
pub fn repo_op_state(
    path: String,
    state: State<'_, AppState>,
) -> Result<crate::git::RepoOpState, GitError> {
    crate::git::repo_op_state(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn recent_repos(state: State<'_, AppState>) -> Result<Vec<RecentRepo>, GitError> {
    Ok(state.recents.lock().map_err(lock_error)?.list())
}

#[tauri::command]
pub fn remove_recent_repo(path: String, state: State<'_, AppState>) -> Result<(), GitError> {
    state.recents.lock().map_err(lock_error)?.remove(&path)
}

fn lock_error<T>(_error: std::sync::PoisonError<T>) -> GitError {
    GitError::Store {
        message: "internal state poisoned".into(),
    }
}

fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}
