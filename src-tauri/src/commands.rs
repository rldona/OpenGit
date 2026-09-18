use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::git::{error::GitError, runner::Runner, version::GitVersion, Commit, Ref, StatusReport};
use crate::jobs::{JobKind, JobManager, RemoteJobEvent};
use crate::repo::{self, ops, recents::Recents, RecentRepo};
use crate::watch::{self, WatcherHandle};

/// Estado compartido por los comandos: runner, recientes, watcher y jobs.
pub struct AppState {
    pub runner: Runner,
    pub recents: Mutex<Recents>,
    pub watcher: Mutex<Option<WatcherHandle>>,
    pub jobs: Arc<JobManager>,
    pub data_dir: PathBuf,
}

#[derive(Clone, Serialize)]
struct JobOutputPayload {
    job_id: String,
    stream: String,
    line: String,
}

#[derive(Clone, Serialize)]
struct JobFinishedPayload {
    job_id: String,
    success: bool,
    exit_code: i32,
    cancelled: bool,
}

/// Arranca fetch/pull/push en segundo plano; la salida llega por eventos
/// `job://output` y `job://finished`. Devuelve el id del job para cancelarlo.
#[tauri::command]
pub fn start_remote_job(
    app: AppHandle,
    path: String,
    kind: JobKind,
    state: State<'_, AppState>,
) -> Result<String, GitError> {
    let job_id = state.jobs.next_id();
    let manager = Arc::clone(&state.jobs);
    let id = job_id.clone();
    crate::jobs::start(
        &state.jobs,
        &job_id,
        &state.runner,
        Path::new(&path),
        &kind,
        move |event| match event {
            RemoteJobEvent::Output { stream, line } => {
                let _ = app.emit(
                    "job://output",
                    JobOutputPayload {
                        job_id: id.clone(),
                        stream: stream.as_str().to_string(),
                        line,
                    },
                );
            }
            RemoteJobEvent::Finished {
                success,
                exit_code,
                cancelled,
            } => {
                manager.remove(&id);
                let _ = app.emit(
                    "job://finished",
                    JobFinishedPayload {
                        job_id: id.clone(),
                        success,
                        exit_code,
                        cancelled,
                    },
                );
            }
        },
    )?;
    Ok(job_id)
}

#[tauri::command]
pub fn cancel_remote_job(job_id: String, state: State<'_, AppState>) -> Result<bool, GitError> {
    Ok(state.jobs.cancel(&job_id))
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
    search: Option<crate::git::LogSearch>,
    state: State<'_, AppState>,
) -> Result<Vec<Commit>, GitError> {
    crate::git::log_page(
        &state.runner,
        Path::new(&path),
        skip,
        limit,
        rev.as_deref(),
        search.as_ref(),
    )
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
pub fn branch_tracking(
    path: String,
    state: State<'_, AppState>,
) -> Result<crate::git::BranchTracking, GitError> {
    crate::git::branch_tracking(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn checkout_ref(
    path: String,
    target: String,
    track: bool,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::checkout_ref(&state.runner, Path::new(&path), &target, track)
    })
}

#[tauri::command]
pub fn create_branch(
    path: String,
    name: String,
    start_point: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::create_branch(&state.runner, Path::new(&path), &name, &start_point)
    })
}

#[tauri::command]
pub fn rename_branch(
    path: String,
    old: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::rename_branch(&state.runner, Path::new(&path), &old, &new_name)
    })
}

#[tauri::command]
pub fn delete_branch(
    path: String,
    name: String,
    force: bool,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::delete_branch(&state.runner, Path::new(&path), &name, force)
    })
}

#[derive(Clone, Serialize)]
pub struct ConflictFile {
    pub content: String,
    pub binary: bool,
}

#[tauri::command]
pub fn rebase_plan(
    path: String,
    base: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::git::PlanCommit>, GitError> {
    crate::git::rebase_plan(&state.runner, Path::new(&path), &base)
}

#[tauri::command]
pub fn interactive_rebase(
    path: String,
    base: String,
    todos: Vec<crate::git::TodoItem>,
    reword_message: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::interactive_rebase(
            &state.runner,
            Path::new(&path),
            &state.data_dir,
            &base,
            &todos,
            reword_message.as_deref(),
        )
    })
}

#[tauri::command]
pub fn read_conflict_file(path: String, file: String) -> Result<ConflictFile, GitError> {
    let (content, binary) = ops::read_worktree_file(Path::new(&path), &file)?;
    Ok(ConflictFile { content, binary })
}

#[tauri::command]
pub fn resolve_conflict(
    path: String,
    file: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        ops::write_and_stage(&state.runner, Path::new(&path), &file, &content)
    })
}

#[tauri::command]
pub fn repo_op_abort(path: String, state: State<'_, AppState>) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::repo_op_abort(&state.runner, Path::new(&path))
    })
}

#[tauri::command]
pub fn repo_op_continue(path: String, state: State<'_, AppState>) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::repo_op_continue(&state.runner, Path::new(&path))
    })
}

#[tauri::command]
pub fn cherry_pick(path: String, hash: String, state: State<'_, AppState>) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::cherry_pick(&state.runner, Path::new(&path), &hash)
    })
}

#[tauri::command]
pub fn revert_commit(
    path: String,
    hash: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::revert_commit(&state.runner, Path::new(&path), &hash)
    })
}

#[tauri::command]
pub fn reset_mixed(path: String, hash: String, state: State<'_, AppState>) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::reset_mixed(&state.runner, Path::new(&path), &hash)
    })
}

#[tauri::command]
pub fn tag_create(
    path: String,
    name: String,
    target: String,
    message: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::tag_create(
            &state.runner,
            Path::new(&path),
            &name,
            &target,
            message.as_deref(),
        )
    })
}

#[tauri::command]
pub fn tag_delete(path: String, name: String, state: State<'_, AppState>) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::tag_delete(&state.runner, Path::new(&path), &name)
    })
}

#[tauri::command]
pub fn stash_list(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::git::Stash>, GitError> {
    crate::git::stash_list(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn stash_push(
    path: String,
    message: Option<String>,
    include_untracked: bool,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::stash_push(
            &state.runner,
            Path::new(&path),
            message.as_deref(),
            include_untracked,
        )
    })
}

#[tauri::command]
pub fn stash_apply(
    path: String,
    reference: String,
    drop: bool,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::stash_apply(&state.runner, Path::new(&path), &reference, drop)
    })
}

#[tauri::command]
pub fn stash_drop(
    path: String,
    reference: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::stash_drop(&state.runner, Path::new(&path), &reference)
    })
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
