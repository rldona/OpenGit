use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::git::{error::GitError, runner::Runner, version::GitVersion, Commit, Ref, StatusReport};
use crate::jobs::{JobKind, JobManager, RemoteJobEvent};
use crate::repo::{self, ops, recents::Recents, RecentRepo};
use crate::watch::{self, WatcherHandle};

/// State shared by the commands: runner, recents, watcher and jobs.
pub struct AppState {
    pub runner: Runner,
    pub recents: Mutex<Recents>,
    pub watcher: Mutex<Option<WatcherHandle>>,
    pub jobs: Arc<JobManager>,
    pub data_dir: PathBuf,
    /// Whether the watcher events reach the UI (OG-067 "Automatically refresh").
    pub auto_refresh: Arc<AtomicBool>,
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

/// Starts fetch/pull/push in the background; output arrives through
/// `job://output` and `job://finished` events. Returns the job id to cancel it.
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

#[tauri::command]
pub fn author_ident(
    path: String,
    state: State<'_, AppState>,
) -> Result<crate::git::AuthorIdent, GitError> {
    crate::git::author_ident(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn config_get(
    path: String,
    key: String,
    scope: crate::git::ConfigScope,
    state: State<'_, AppState>,
) -> Result<Option<String>, GitError> {
    crate::git::config_get(&state.runner, Path::new(&path), &key, scope)
}

#[tauri::command]
pub fn config_set(
    path: String,
    key: String,
    value: String,
    scope: crate::git::ConfigScope,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    crate::git::config_set(&state.runner, Path::new(&path), &key, &value, scope)
}

#[tauri::command]
pub fn config_unset(
    path: String,
    key: String,
    scope: crate::git::ConfigScope,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    crate::git::config_unset(&state.runner, Path::new(&path), &key, scope)
}

/// Repository-specific ignore file (`info/exclude`), so the UI can open it.
#[tauri::command]
pub fn ignore_exclude_path(path: String, state: State<'_, AppState>) -> Result<String, GitError> {
    crate::git::ignore_exclude_path(&state.runner, Path::new(&path))
}

/// Turns the watcher events on or off for the open repository.
#[tauri::command]
pub fn set_auto_refresh(enabled: bool, state: State<'_, AppState>) {
    state.auto_refresh.store(enabled, Ordering::SeqCst);
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

/// Runs an operation of our own with the watcher silenced, emitting at most
/// one refresh when it finishes.
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

/// Validates the folder, returns the repo info, adds it to recents and
/// starts watching `.git` (stopping the previous watcher).
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
    let auto_refresh = Arc::clone(&state.auto_refresh);
    if let Ok(handle) = watch::start(PathBuf::from(&info.root), move |kind| {
        if auto_refresh.load(Ordering::SeqCst) {
            let _ = app.emit(kind.event_name(), event_root.clone());
        }
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

/// Destructive: the UI must confirm it before invoking it.
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

/// Partial stage/unstage by hunk or by lines (OG-006).
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

/// Destructive: discards hunks/lines from the working tree (confirmed in the UI).
#[tauri::command]
pub fn discard_selection(
    path: String,
    file: String,
    selection: crate::git::patch::HunkSelection,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::discard_selection(&state.runner, Path::new(&path), &file, &selection)
    })
}

/// Destructive: deletes an untracked file (confirmed in the UI beforehand).
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
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::interactive_rebase(
            &state.runner,
            Path::new(&path),
            &state.data_dir,
            &base,
            &todos,
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
pub fn repo_op_skip(path: String, state: State<'_, AppState>) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::repo_op_skip(&state.runner, Path::new(&path))
    })
}

#[tauri::command]
pub fn cherry_pick(path: String, hash: String, state: State<'_, AppState>) -> Result<(), GitError> {
    pause_while(&state, || {
        crate::git::cherry_pick(&state.runner, Path::new(&path), &hash)
    })
}

#[tauri::command]
pub fn image_pair(
    path: String,
    file: String,
    rev: Option<String>,
    staged: bool,
    state: State<'_, AppState>,
) -> Result<crate::git::ImagePair, GitError> {
    crate::git::image_pair(
        &state.runner,
        Path::new(&path),
        &file,
        rev.as_deref(),
        staged,
    )
}

/// Raw image bytes; the webview receives an ArrayBuffer (Tauri `Response`).
#[tauri::command]
pub fn image_blob(
    path: String,
    file: String,
    rev: Option<String>,
    staged: bool,
    side: String,
    state: State<'_, AppState>,
) -> Result<tauri::ipc::Response, GitError> {
    let bytes = crate::git::image_bytes(
        &state.runner,
        Path::new(&path),
        &file,
        rev.as_deref(),
        staged,
        &side,
    )?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn merge_branch(
    path: String,
    rev: String,
    options: crate::git::MergeOptions,
    state: State<'_, AppState>,
) -> Result<crate::git::MergeResult, GitError> {
    pause_while(&state, || {
        crate::git::merge_branch(&state.runner, Path::new(&path), &rev, options)
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
pub fn stash_show(
    path: String,
    reference: String,
    state: State<'_, AppState>,
) -> Result<String, GitError> {
    crate::git::stash_show(&state.runner, Path::new(&path), &reference)
}

#[tauri::command]
pub fn recent_repos(state: State<'_, AppState>) -> Result<Vec<RecentRepo>, GitError> {
    Ok(state.recents.lock().map_err(lock_error)?.list())
}

#[tauri::command]
pub fn submodule_status(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::git::Submodule>, GitError> {
    crate::git::submodule_status(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn worktree_list(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::git::Worktree>, GitError> {
    crate::git::worktree_list(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn lfs_status(
    path: String,
    state: State<'_, AppState>,
) -> Result<crate::git::LfsStatus, GitError> {
    crate::git::lfs_status(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn remote_urls(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::git::Remote>, GitError> {
    crate::git::remote_urls(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn remote_add(
    path: String,
    name: String,
    url: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    crate::git::remote_add(&state.runner, Path::new(&path), &name, &url)
}

#[tauri::command]
pub fn remote_set_url(
    path: String,
    name: String,
    url: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    crate::git::remote_set_url(&state.runner, Path::new(&path), &name, &url)
}

#[tauri::command]
pub fn remote_rename(
    path: String,
    old: String,
    new: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    crate::git::remote_rename(&state.runner, Path::new(&path), &old, &new)
}

#[tauri::command]
pub fn remote_remove(
    path: String,
    name: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    crate::git::remote_remove(&state.runner, Path::new(&path), &name)
}

/// Repository git config file (`<gitdir>/config`), for "Edit Config File…".
#[tauri::command]
pub fn git_config_path(path: String, state: State<'_, AppState>) -> Result<String, GitError> {
    crate::git::git_config_path(&state.runner, Path::new(&path))
}

#[tauri::command]
pub fn tracking_commits(
    path: String,
    upstream: String,
    state: State<'_, AppState>,
) -> Result<crate::git::TrackingCommits, GitError> {
    crate::git::tracking_commits(&state.runner, Path::new(&path), &upstream)
}

#[tauri::command]
pub fn remove_recent_repo(path: String, state: State<'_, AppState>) -> Result<(), GitError> {
    state.recents.lock().map_err(lock_error)?.remove(&path)
}

/// Opens a system terminal at `path`.
///
/// The program and its arguments are always passed as argv (rule 3 of
/// AGENTS.md): no building a shell command with the path interpolated,
/// which in a repo named `foo; rm -rf ~` would be a textbook injection.
#[tauri::command]
pub fn open_terminal(path: String) -> Result<(), GitError> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(GitError::invalid(format!("not a directory: {path}")));
    }
    terminal_candidates(dir)
        .into_iter()
        .find_map(|(program, args)| {
            std::process::Command::new(program)
                .args(&args)
                .spawn()
                .ok()
                .map(|_| ())
        })
        .ok_or_else(|| GitError::invalid("no terminal emulator available".to_string()))
}

/// Opens a file or folder with the system default application.
///
/// Same argv rule as `open_terminal`: the path is never interpolated into a
/// shell command.
#[tauri::command]
pub fn open_path(path: String) -> Result<(), GitError> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err(GitError::invalid(format!("path does not exist: {path}")));
    }
    open_candidates(target)
        .into_iter()
        .find_map(|(program, args)| {
            std::process::Command::new(program)
                .args(&args)
                .spawn()
                .ok()
                .map(|_| ())
        })
        .ok_or_else(|| GitError::invalid("no application available to open the file".to_string()))
}

/// Candidates per platform, in order of preference.
fn open_candidates(path: &Path) -> Vec<(&'static str, Vec<std::ffi::OsString>)> {
    let target = path.as_os_str().to_os_string();
    #[cfg(target_os = "macos")]
    {
        vec![("open", vec![target])]
    }
    #[cfg(target_os = "windows")]
    {
        vec![("cmd", vec!["/c".into(), "start".into(), "".into(), target])]
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        vec![("xdg-open", vec![target])]
    }
}

/// Candidates per platform, in order of preference.
fn terminal_candidates(dir: &Path) -> Vec<(&'static str, Vec<std::ffi::OsString>)> {
    let path = dir.as_os_str().to_os_string();
    #[cfg(target_os = "macos")]
    {
        vec![("open", vec!["-a".into(), "Terminal".into(), path])]
    }
    #[cfg(target_os = "windows")]
    {
        // `wt` (Windows Terminal) when available; otherwise the classic console.
        vec![
            ("wt", vec!["-d".into(), path.clone()]),
            ("cmd", vec!["/c".into(), "start".into(), "cmd".into()]),
        ]
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        vec![
            ("x-terminal-emulator", vec![]),
            ("gnome-terminal", vec![]),
            ("konsole", vec![]),
            ("xterm", vec![]),
        ]
        .into_iter()
        .map(
            |(program, mut args): (&'static str, Vec<std::ffi::OsString>)| {
                args.push("--working-directory".into());
                args.push(path.clone());
                (program, args)
            },
        )
        .collect()
    }
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
