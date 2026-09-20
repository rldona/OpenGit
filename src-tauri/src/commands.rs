use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::git::{error::GitError, runner::Runner, version::GitVersion, Commit, Ref, StatusReport};
use crate::jobs::{JobKind, JobManager, RemoteJobEvent};
use crate::repo::{self, ops, recents::Recents, RecentRepo};
use crate::watch::{self, WatcherHandle};

/// State shared by the commands: runner, recents, watchers and jobs.
pub struct AppState {
    pub runner: Runner,
    pub recents: Mutex<Recents>,
    /// One watcher per window label (ADR-0008), so windows do not stop each other.
    pub watchers: Mutex<HashMap<String, WatcherHandle>>,
    /// Per-window watcher generation, bumped on every open/close/destroy so a
    /// superseded in-flight `open_repo` cannot install a stale watcher.
    pub watcher_epoch: Mutex<HashMap<String, u64>>,
    /// Repository a new window must open on startup, keyed by its label.
    pub pending_repo: Mutex<HashMap<String, String>>,
    pub window_counter: AtomicU64,
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

/// Runs blocking work on the runtime's blocking pool, so git never runs on the
/// GTK main thread (ADR-0010).
async fn blocking<T, F>(work: F) -> Result<T, GitError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, GitError> + Send + 'static,
{
    match tauri::async_runtime::spawn_blocking(work).await {
        Ok(result) => result,
        Err(error) => Err(GitError::Spawn {
            message: format!("background task failed: {error}"),
        }),
    }
}

/// Same as [`blocking`], resolving the shared [`AppState`] inside the task from
/// the [`AppHandle`].
async fn blocking_state<T, F>(app: AppHandle, work: F) -> Result<T, GitError>
where
    T: Send + 'static,
    F: FnOnce(&AppState) -> Result<T, GitError> + Send + 'static,
{
    match tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        work(state.inner())
    })
    .await
    {
        Ok(result) => result,
        Err(error) => Err(GitError::Spawn {
            message: format!("background task failed: {error}"),
        }),
    }
}

/// Starts fetch/pull/push in the background; output arrives through
/// `job://output` and `job://finished` events. Returns the job id to cancel it.
#[tauri::command]
pub async fn start_remote_job(
    app: AppHandle,
    path: String,
    kind: JobKind,
) -> Result<String, GitError> {
    let emit_app = app.clone();
    blocking_state(app, move |state| {
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
                    let _ = emit_app.emit(
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
                    let _ = emit_app.emit(
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
    })
    .await
}

#[tauri::command]
pub fn cancel_remote_job(job_id: String, state: State<'_, AppState>) -> Result<bool, GitError> {
    Ok(state.jobs.cancel(&job_id))
}

#[tauri::command]
pub async fn author_ident(
    path: String,
    app: AppHandle,
) -> Result<crate::git::AuthorIdent, GitError> {
    blocking_state(app, move |state| {
        crate::git::author_ident(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn config_get(
    path: String,
    key: String,
    scope: crate::git::ConfigScope,
    app: AppHandle,
) -> Result<Option<String>, GitError> {
    blocking_state(app, move |state| {
        crate::git::config_get(&state.runner, Path::new(&path), &key, scope)
    })
    .await
}

#[tauri::command]
pub async fn config_set(
    path: String,
    key: String,
    value: String,
    scope: crate::git::ConfigScope,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        crate::git::config_set(&state.runner, Path::new(&path), &key, &value, scope)
    })
    .await
}

#[tauri::command]
pub async fn config_unset(
    path: String,
    key: String,
    scope: crate::git::ConfigScope,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        crate::git::config_unset(&state.runner, Path::new(&path), &key, scope)
    })
    .await
}

/// Repository-specific ignore file (`info/exclude`), so the UI can open it.
#[tauri::command]
pub async fn ignore_exclude_path(path: String, app: AppHandle) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        crate::git::ignore_exclude_path(&state.runner, Path::new(&path))
    })
    .await
}

/// Turns the watcher events on or off for the open repository.
#[tauri::command]
pub fn set_auto_refresh(enabled: bool, state: State<'_, AppState>) {
    state.auto_refresh.store(enabled, Ordering::SeqCst);
}

impl AppState {
    /// Bumps and returns this window's watcher generation. Any in-flight
    /// `open_repo` holding an older generation must discard its watcher.
    fn bump_watcher_epoch(&self, label: &str) -> Result<u64, GitError> {
        let mut epochs = self.watcher_epoch.lock().map_err(lock_error)?;
        let value = epochs.entry(label.to_string()).or_insert(0);
        *value += 1;
        Ok(*value)
    }

    fn pause_watcher(&self) {
        if let Ok(watchers) = self.watchers.lock() {
            for watcher in watchers.values() {
                watcher.pause();
            }
        }
    }

    fn resume_watcher(&self) {
        if let Ok(watchers) = self.watchers.lock() {
            for watcher in watchers.values() {
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
pub async fn git_version(app: AppHandle) -> Result<GitVersion, GitError> {
    blocking_state(app, move |state| state.runner.version()).await
}

/// Validates the folder, returns the repo info, adds it to recents and
/// starts watching the working tree and `.git` (stopping the previous watcher).
#[tauri::command]
pub async fn open_repo(
    app: AppHandle,
    window: tauri::WebviewWindow,
    path: String,
) -> Result<repo::RepoInfo, GitError> {
    let label = window.label().to_string();
    let emit_app = app.clone();
    // Captured before the slow git work: a close/destroy or a newer open for
    // the same window bumps the epoch and supersedes this attempt.
    let epoch = app.state::<AppState>().bump_watcher_epoch(&label)?;
    blocking_state(app, move |state| {
        let info = repo::open(&state.runner, Path::new(&path))?;
        let recent = RecentRepo {
            path: info.root.clone(),
            name: info.name.clone(),
            opened_at: now(),
        };
        state.recents.lock().map_err(lock_error)?.add(&recent)?;

        let event_root = info.root.clone();
        let auto_refresh = Arc::clone(&state.auto_refresh);
        let watcher = watch::start(
            state.runner.clone(),
            PathBuf::from(&info.root),
            move |kind| {
                if auto_refresh.load(Ordering::SeqCst) {
                    let _ = emit_app.emit(kind.event_name(), event_root.clone());
                }
            },
        );
        // When both locks are needed at once the order is `watchers` then
        // `watcher_epoch`; other call sites take them one at a time. They are
        // held only for the check-and-swap, stopping happens outside.
        let mut watchers = state.watchers.lock().map_err(lock_error)?;
        let is_current = state
            .watcher_epoch
            .lock()
            .map_err(lock_error)?
            .get(&label)
            .copied()
            == Some(epoch);
        if !is_current {
            drop(watchers);
            watcher.stop_detached();
            return Ok(info);
        }
        let previous = watchers.insert(label, watcher);
        drop(watchers);
        if let Some(previous) = previous {
            previous.stop_detached();
        }
        Ok(info)
    })
    .await
}

/// Opens `path` in a new window (ADR-0008); the new window asks for it through
/// `initial_repo` on startup.
#[tauri::command]
pub fn open_repo_in_new_window(
    app: AppHandle,
    path: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    let label = format!(
        "repo-{}",
        state.window_counter.fetch_add(1, Ordering::SeqCst)
    );
    state
        .pending_repo
        .lock()
        .map_err(lock_error)?
        .insert(label.clone(), path);

    tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::default())
        .title("OpenGit")
        .inner_size(1200.0, 800.0)
        .build()
        .map_err(|error| GitError::invalid(format!("could not open a new window: {error}")))?;
    Ok(())
}

/// Repository a new window must open, once (ADR-0008); `None` for the main one.
#[tauri::command]
pub fn initial_repo(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
) -> Result<Option<String>, GitError> {
    let label = window.label().to_string();
    Ok(state
        .pending_repo
        .lock()
        .map_err(lock_error)?
        .remove(&label))
}

/// `.gitignore` templates for the "Create repository" dialog (OG-086).
#[tauri::command]
pub fn gitignore_templates() -> Vec<repo::GitignoreTemplate> {
    repo::gitignore_templates()
}

/// Creates a repository at `path`; the UI opens it afterwards (OG-086).
#[tauri::command]
pub async fn init_repo(
    path: String,
    branch: String,
    template: Option<String>,
    initial_commit: bool,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        repo::init(
            &state.runner,
            Path::new(&path),
            &branch,
            template.as_deref(),
            initial_commit,
        )
    })
    .await
}

#[tauri::command]
pub async fn close_repo(app: AppHandle, window: tauri::WebviewWindow) -> Result<(), GitError> {
    let label = window.label().to_string();
    blocking_state(app, move |state| {
        // Invalidate any in-flight `open_repo` for this window before removing
        // the watcher, so it cannot reinstall one nobody will stop.
        state.bump_watcher_epoch(&label)?;
        let previous = state.watchers.lock().map_err(lock_error)?.remove(&label);
        if let Some(previous) = previous {
            previous.stop();
        }
        Ok(())
    })
    .await
}

/// Searches the working tree with `git grep` (OG-093).
#[tauri::command]
pub async fn grep_worktree(
    path: String,
    query: crate::git::GrepQuery,
    app: AppHandle,
) -> Result<crate::git::GrepResult, GitError> {
    blocking_state(app, move |state| {
        crate::git::grep_worktree(&state.runner, Path::new(&path), &query)
    })
    .await
}

/// Writes patch files for a commit or a range (OG-094).
#[tauri::command]
pub async fn format_patch(
    path: String,
    spec: String,
    single: bool,
    out_dir: String,
    app: AppHandle,
) -> Result<Vec<String>, GitError> {
    blocking_state(app, move |state| {
        crate::git::format_patch(
            &state.runner,
            Path::new(&path),
            &spec,
            single,
            Path::new(&out_dir),
        )
    })
    .await
}

/// Applies a mailbox patch or a plain diff (OG-094).
#[tauri::command]
pub async fn apply_patch(
    path: String,
    file: String,
    mailbox: bool,
    three_way: bool,
    app: AppHandle,
) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        crate::git::apply_patch(
            &state.runner,
            Path::new(&path),
            Path::new(&file),
            mailbox,
            three_way,
        )
    })
    .await
}

#[tauri::command]
pub async fn log_page(
    path: String,
    skip: usize,
    limit: usize,
    rev: Option<String>,
    search: Option<crate::git::LogSearch>,
    app: AppHandle,
) -> Result<Vec<Commit>, GitError> {
    blocking_state(app, move |state| {
        crate::git::log_page(
            &state.runner,
            Path::new(&path),
            skip,
            limit,
            rev.as_deref(),
            search.as_ref(),
        )
    })
    .await
}

#[tauri::command]
pub async fn list_refs(path: String, app: AppHandle) -> Result<Vec<Ref>, GitError> {
    blocking_state(app, move |state| {
        crate::git::refs(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn blame_file(
    path: String,
    file: String,
    app: AppHandle,
) -> Result<Vec<crate::git::BlameLine>, GitError> {
    blocking_state(app, move |state| {
        crate::git::blame_file(&state.runner, Path::new(&path), &file)
    })
    .await
}

#[tauri::command]
pub async fn status_repo(path: String, app: AppHandle) -> Result<StatusReport, GitError> {
    blocking_state(app, move |state| {
        crate::git::status(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn stage_path(
    path: String,
    file: String,
    orig_file: Option<String>,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        let mut files = vec![file];
        if let Some(orig) = orig_file {
            files.push(orig);
        }
        let file_refs: Vec<&str> = files.iter().map(String::as_str).collect();
        pause_while(state, || {
            ops::stage_paths(&state.runner, Path::new(&path), &file_refs)
        })
    })
    .await
}

#[tauri::command]
pub async fn unstage_path(
    path: String,
    file: String,
    orig_file: Option<String>,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        let mut files = vec![file];
        if let Some(orig) = orig_file {
            files.push(orig);
        }
        let file_refs: Vec<&str> = files.iter().map(String::as_str).collect();
        pause_while(state, || {
            ops::unstage_paths(&state.runner, Path::new(&path), &file_refs)
        })
    })
    .await
}

/// Destructive: the UI must confirm it before invoking it.
#[tauri::command]
pub async fn discard_path(
    path: String,
    file: String,
    orig_file: Option<String>,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        let mut files = vec![file];
        if let Some(orig) = orig_file {
            files.push(orig);
        }
        let file_refs: Vec<&str> = files.iter().map(String::as_str).collect();
        pause_while(state, || {
            ops::discard_paths(&state.runner, Path::new(&path), &file_refs)
        })
    })
    .await
}

/// Partial stage/unstage by hunk or by lines (OG-006).
#[tauri::command]
pub async fn stage_selection(
    path: String,
    file: String,
    staged: bool,
    selection: crate::git::patch::HunkSelection,
    reverse: bool,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::stage_selection(
                &state.runner,
                Path::new(&path),
                &file,
                staged,
                &selection,
                reverse,
            )
        })
    })
    .await
}

/// Destructive: discards hunks/lines from the working tree (confirmed in the UI).
#[tauri::command]
pub async fn discard_selection(
    path: String,
    file: String,
    selection: crate::git::patch::HunkSelection,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::discard_selection(&state.runner, Path::new(&path), &file, &selection)
        })
    })
    .await
}

/// Destructive: deletes an untracked file (confirmed in the UI beforehand).
#[tauri::command]
pub async fn delete_untracked(path: String, file: String, app: AppHandle) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || ops::remove_untracked(Path::new(&path), &file))
    })
    .await
}

#[tauri::command]
pub async fn diff_file(
    path: String,
    file: String,
    staged: bool,
    rev: Option<String>,
    reversed: bool,
    options: crate::git::DiffOptions,
    app: AppHandle,
) -> Result<String, GitError> {
    blocking_state(app, move |state| match rev {
        Some(rev) => crate::git::commit_file_diff(
            &state.runner,
            Path::new(&path),
            &rev,
            &file,
            reversed,
            &options,
        ),
        None => crate::git::worktree_file_diff(
            &state.runner,
            Path::new(&path),
            &file,
            staged,
            reversed,
            &options,
        ),
    })
    .await
}

/// Preview of an untracked file as a new-file patch (OG-071).
#[tauri::command]
pub async fn untracked_file_diff(
    path: String,
    file: String,
    app: AppHandle,
) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        crate::git::untracked_file_diff(&state.runner, Path::new(&path), &file)
    })
    .await
}

#[tauri::command]
pub async fn commit_files(
    path: String,
    rev: String,
    app: AppHandle,
) -> Result<Vec<crate::git::FileDiff>, GitError> {
    blocking_state(app, move |state| {
        crate::git::commit_files(&state.runner, Path::new(&path), &rev)
    })
    .await
}

#[tauri::command]
pub async fn diff_numstat(
    path: String,
    cached: bool,
    app: AppHandle,
) -> Result<Vec<crate::git::FileDiff>, GitError> {
    blocking_state(app, move |state| {
        crate::git::diff_numstat(&state.runner, Path::new(&path), cached)
    })
    .await
}

#[tauri::command]
pub async fn compare_numstat(
    path: String,
    base: String,
    rev: String,
    app: AppHandle,
) -> Result<Vec<crate::git::FileDiff>, GitError> {
    blocking_state(app, move |state| {
        crate::git::compare_numstat(&state.runner, Path::new(&path), &base, &rev)
    })
    .await
}

#[tauri::command]
pub async fn compare_file(
    path: String,
    base: String,
    rev: String,
    file: String,
    reversed: bool,
    options: crate::git::DiffOptions,
    app: AppHandle,
) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        crate::git::compare_file_diff(
            &state.runner,
            Path::new(&path),
            &base,
            &rev,
            &file,
            reversed,
            &options,
        )
    })
    .await
}

#[tauri::command]
pub async fn commit_message(path: String, app: AppHandle) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        crate::git::last_commit_message(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn commit_repo(
    path: String,
    message: String,
    amend: bool,
    app: AppHandle,
) -> Result<crate::git::CommitResult, GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::commit(&state.runner, Path::new(&path), &message, amend)
        })
    })
    .await
}

#[tauri::command]
pub async fn repo_op_state(
    path: String,
    app: AppHandle,
) -> Result<crate::git::RepoOpState, GitError> {
    blocking_state(app, move |state| {
        crate::git::repo_op_state(&state.runner, Path::new(&path))
    })
    .await
}

/// Starts a bisect (OG-090).
#[tauri::command]
pub async fn bisect_start(
    path: String,
    bad: Option<String>,
    good: Vec<String>,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::bisect_start(&state.runner, Path::new(&path), bad.as_deref(), &good)
        })
    })
    .await
}

/// Marks the current bisect candidate (OG-090).
#[tauri::command]
pub async fn bisect_mark(
    path: String,
    kind: crate::git::BisectMark,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::bisect_mark(&state.runner, Path::new(&path), kind)
        })
    })
    .await
}

/// Ends the bisect (OG-090).
#[tauri::command]
pub async fn bisect_reset(path: String, app: AppHandle) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::bisect_reset(&state.runner, Path::new(&path))
        })
    })
    .await
}

/// Reads the bisect state (OG-090).
#[tauri::command]
pub async fn bisect_state(
    path: String,
    app: AppHandle,
) -> Result<crate::git::BisectState, GitError> {
    blocking_state(app, move |state| {
        crate::git::bisect_state(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn branch_tracking(
    path: String,
    app: AppHandle,
) -> Result<crate::git::BranchTracking, GitError> {
    blocking_state(app, move |state| {
        crate::git::branch_tracking(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn checkout_ref(
    path: String,
    target: String,
    track: bool,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::checkout_ref(&state.runner, Path::new(&path), &target, track)
        })
    })
    .await
}

#[tauri::command]
pub async fn create_branch(
    path: String,
    name: String,
    start_point: String,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::create_branch(&state.runner, Path::new(&path), &name, &start_point)
        })
    })
    .await
}

#[tauri::command]
pub async fn rename_branch(
    path: String,
    old: String,
    new_name: String,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::rename_branch(&state.runner, Path::new(&path), &old, &new_name)
        })
    })
    .await
}

#[tauri::command]
pub async fn delete_branch(
    path: String,
    name: String,
    force: bool,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::delete_branch(&state.runner, Path::new(&path), &name, force)
        })
    })
    .await
}

#[derive(Clone, Serialize)]
pub struct ConflictFile {
    pub content: String,
    pub binary: bool,
}

#[tauri::command]
pub async fn rebase_plan(
    path: String,
    base: String,
    app: AppHandle,
) -> Result<Vec<crate::git::PlanCommit>, GitError> {
    blocking_state(app, move |state| {
        crate::git::rebase_plan(&state.runner, Path::new(&path), &base)
    })
    .await
}

#[tauri::command]
pub async fn interactive_rebase(
    path: String,
    base: String,
    todos: Vec<crate::git::TodoItem>,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::interactive_rebase(
                &state.runner,
                Path::new(&path),
                &state.data_dir,
                &base,
                &todos,
            )
        })
    })
    .await
}

#[tauri::command]
pub async fn read_conflict_file(path: String, file: String) -> Result<ConflictFile, GitError> {
    blocking(move || {
        let (content, binary) = ops::read_worktree_file(Path::new(&path), &file)?;
        Ok(ConflictFile { content, binary })
    })
    .await
}

#[tauri::command]
pub async fn resolve_conflict(
    path: String,
    file: String,
    content: String,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            ops::write_and_stage(&state.runner, Path::new(&path), &file, &content)
        })
    })
    .await
}

#[tauri::command]
pub async fn repo_op_abort(path: String, app: AppHandle) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::repo_op_abort(&state.runner, Path::new(&path))
        })
    })
    .await
}

#[tauri::command]
pub async fn repo_op_continue(path: String, app: AppHandle) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::repo_op_continue(&state.runner, Path::new(&path))
        })
    })
    .await
}

#[tauri::command]
pub async fn repo_op_skip(path: String, app: AppHandle) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::repo_op_skip(&state.runner, Path::new(&path))
        })
    })
    .await
}

#[tauri::command]
pub async fn cherry_pick(path: String, hash: String, app: AppHandle) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::cherry_pick(&state.runner, Path::new(&path), &hash)
        })
    })
    .await
}

/// Reads the reflog, newest first (OG-089).
#[tauri::command]
pub async fn reflog(
    path: String,
    limit: usize,
    app: AppHandle,
) -> Result<Vec<crate::git::ReflogEntry>, GitError> {
    blocking_state(app, move |state| {
        crate::git::reflog(&state.runner, Path::new(&path), limit)
    })
    .await
}

/// Cherry-picks several commits or a range (OG-096).
#[tauri::command]
pub async fn cherry_pick_range(
    path: String,
    revs: Vec<String>,
    record_source: bool,
    app: AppHandle,
) -> Result<crate::git::MergeResult, GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::cherry_pick_range(&state.runner, Path::new(&path), &revs, record_source)
        })
    })
    .await
}

#[tauri::command]
pub async fn image_pair(
    path: String,
    file: String,
    rev: Option<String>,
    staged: bool,
    app: AppHandle,
) -> Result<crate::git::ImagePair, GitError> {
    blocking_state(app, move |state| {
        crate::git::image_pair(
            &state.runner,
            Path::new(&path),
            &file,
            rev.as_deref(),
            staged,
        )
    })
    .await
}

/// Raw image bytes; the webview receives an ArrayBuffer (Tauri `Response`).
#[tauri::command]
pub async fn image_blob(
    path: String,
    file: String,
    rev: Option<String>,
    staged: bool,
    side: String,
    app: AppHandle,
) -> Result<tauri::ipc::Response, GitError> {
    blocking_state(app, move |state| {
        let bytes = crate::git::image_bytes(
            &state.runner,
            Path::new(&path),
            &file,
            rev.as_deref(),
            staged,
            &side,
        )?;
        Ok(tauri::ipc::Response::new(bytes))
    })
    .await
}

#[tauri::command]
pub async fn merge_branch(
    path: String,
    rev: String,
    options: crate::git::MergeOptions,
    app: AppHandle,
) -> Result<crate::git::MergeResult, GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::merge_branch(&state.runner, Path::new(&path), &rev, options)
        })
    })
    .await
}

#[tauri::command]
pub async fn revert_commit(
    path: String,
    hash: String,
    mainline: Option<u32>,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::revert_commit(&state.runner, Path::new(&path), &hash, mainline)
        })
    })
    .await
}

#[tauri::command]
pub async fn reset_to(
    path: String,
    hash: String,
    mode: crate::git::ResetMode,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::reset(&state.runner, Path::new(&path), &hash, mode)
        })
    })
    .await
}

#[tauri::command]
pub async fn tag_create(
    path: String,
    name: String,
    target: String,
    message: Option<String>,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::tag_create(
                &state.runner,
                Path::new(&path),
                &name,
                &target,
                message.as_deref(),
            )
        })
    })
    .await
}

#[tauri::command]
pub async fn tag_delete(path: String, name: String, app: AppHandle) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::tag_delete(&state.runner, Path::new(&path), &name)
        })
    })
    .await
}

#[tauri::command]
pub async fn stash_list(path: String, app: AppHandle) -> Result<Vec<crate::git::Stash>, GitError> {
    blocking_state(app, move |state| {
        crate::git::stash_list(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn stash_push(
    path: String,
    message: Option<String>,
    include_untracked: bool,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::stash_push(
                &state.runner,
                Path::new(&path),
                message.as_deref(),
                include_untracked,
            )
        })
    })
    .await
}

#[tauri::command]
pub async fn stash_apply(
    path: String,
    reference: String,
    drop: bool,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::stash_apply(&state.runner, Path::new(&path), &reference, drop)
        })
    })
    .await
}

#[tauri::command]
pub async fn stash_drop(path: String, reference: String, app: AppHandle) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::stash_drop(&state.runner, Path::new(&path), &reference)
        })
    })
    .await
}

#[tauri::command]
pub async fn stash_show(
    path: String,
    reference: String,
    app: AppHandle,
) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        crate::git::stash_show(&state.runner, Path::new(&path), &reference)
    })
    .await
}

#[tauri::command]
pub async fn recent_repos(app: AppHandle) -> Result<Vec<RecentRepo>, GitError> {
    blocking_state(app, move |state| {
        Ok(state.recents.lock().map_err(lock_error)?.list())
    })
    .await
}

#[tauri::command]
pub async fn submodule_status(
    path: String,
    app: AppHandle,
) -> Result<Vec<crate::git::Submodule>, GitError> {
    blocking_state(app, move |state| {
        crate::git::submodule_status(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn submodule_update(
    path: String,
    init: bool,
    recursive: bool,
    app: AppHandle,
) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::submodule_update(&state.runner, Path::new(&path), init, recursive)
        })
    })
    .await
}

#[tauri::command]
pub async fn submodule_sync(path: String, app: AppHandle) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::submodule_sync(&state.runner, Path::new(&path))
        })
    })
    .await
}

#[tauri::command]
pub async fn submodule_add(
    path: String,
    url: String,
    subpath: String,
    app: AppHandle,
) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::submodule_add(&state.runner, Path::new(&path), &url, &subpath)
        })
    })
    .await
}

#[tauri::command]
pub async fn worktree_list(
    path: String,
    app: AppHandle,
) -> Result<Vec<crate::git::Worktree>, GitError> {
    blocking_state(app, move |state| {
        crate::git::worktree_list(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn worktree_add(
    path: String,
    worktree: String,
    branch: String,
    create: bool,
    start_point: Option<String>,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::worktree_add(
                &state.runner,
                Path::new(&path),
                &worktree,
                &branch,
                create,
                start_point.as_deref(),
            )
        })
    })
    .await
}

#[tauri::command]
pub async fn worktree_remove(
    path: String,
    worktree: String,
    force: bool,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::worktree_remove(&state.runner, Path::new(&path), &worktree, force)
        })
    })
    .await
}

#[tauri::command]
pub async fn lfs_status(path: String, app: AppHandle) -> Result<crate::git::LfsStatus, GitError> {
    blocking_state(app, move |state| {
        crate::git::lfs_status(&state.runner, Path::new(&path))
    })
    .await
}

/// Starts tracking a pattern with Git LFS, updating `.gitattributes` (OG-097).
#[tauri::command]
pub async fn lfs_track(path: String, pattern: String, app: AppHandle) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::lfs_track(&state.runner, Path::new(&path), &pattern)
        })
    })
    .await
}

#[tauri::command]
pub async fn hooks_list(path: String, app: AppHandle) -> Result<Vec<crate::git::Hook>, GitError> {
    blocking_state(app, move |state| {
        crate::git::hooks_list(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn hook_read(path: String, name: String, app: AppHandle) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        crate::git::hook_read(&state.runner, Path::new(&path), &name)
    })
    .await
}

/// Writes and enables a hook (OG-098).
#[tauri::command]
pub async fn hook_write(
    path: String,
    name: String,
    contents: String,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::hook_write(&state.runner, Path::new(&path), &name, &contents)
        })
    })
    .await
}

#[tauri::command]
pub async fn hook_set_enabled(
    path: String,
    name: String,
    enabled: bool,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        pause_while(state, || {
            crate::git::hook_set_enabled(&state.runner, Path::new(&path), &name, enabled)
        })
    })
    .await
}

#[tauri::command]
pub async fn remote_urls(
    path: String,
    app: AppHandle,
) -> Result<Vec<crate::git::Remote>, GitError> {
    blocking_state(app, move |state| {
        crate::git::remote_urls(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn remote_add(
    path: String,
    name: String,
    url: String,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        crate::git::remote_add(&state.runner, Path::new(&path), &name, &url)
    })
    .await
}

#[tauri::command]
pub async fn remote_set_url(
    path: String,
    name: String,
    url: String,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        crate::git::remote_set_url(&state.runner, Path::new(&path), &name, &url)
    })
    .await
}

#[tauri::command]
pub async fn remote_rename(
    path: String,
    old: String,
    new: String,
    app: AppHandle,
) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        crate::git::remote_rename(&state.runner, Path::new(&path), &old, &new)
    })
    .await
}

#[tauri::command]
pub async fn remote_remove(path: String, name: String, app: AppHandle) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        crate::git::remote_remove(&state.runner, Path::new(&path), &name)
    })
    .await
}

/// Repository git config file (`<gitdir>/config`), for "Edit Config File…".
#[tauri::command]
pub async fn git_config_path(path: String, app: AppHandle) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        crate::git::git_config_path(&state.runner, Path::new(&path))
    })
    .await
}

#[tauri::command]
pub async fn commit_template_read(path: String, app: AppHandle) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        crate::git::commit_template_read(&state.runner, Path::new(&path))
    })
    .await
}

/// Writes the template and points `commit.template` at it; returns the path.
#[tauri::command]
pub async fn commit_template_write(
    path: String,
    contents: String,
    app: AppHandle,
) -> Result<String, GitError> {
    blocking_state(app, move |state| {
        crate::git::commit_template_write(&state.runner, Path::new(&path), &contents)
    })
    .await
}

/// Reads a small UTF-8 file for the template "Import…".
#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, GitError> {
    blocking(move || crate::git::read_text_file(&path)).await
}

/// Secret GPG keys available for commit signing; empty when gpg is missing.
///
/// The return type stays a plain list (the UI expects one), so it cannot use
/// [`blocking`]; the gpg call runs on the blocking pool and a failed join
/// degrades to the same empty list gpg's absence already produces.
#[tauri::command]
pub async fn gpg_secret_keys() -> Vec<crate::git::GpgKey> {
    tauri::async_runtime::spawn_blocking(crate::git::gpg_secret_keys)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn tracking_commits(
    path: String,
    upstream: String,
    app: AppHandle,
) -> Result<crate::git::TrackingCommits, GitError> {
    blocking_state(app, move |state| {
        crate::git::tracking_commits(&state.runner, Path::new(&path), &upstream)
    })
    .await
}

#[tauri::command]
pub async fn remove_recent_repo(path: String, app: AppHandle) -> Result<(), GitError> {
    blocking_state(app, move |state| {
        state.recents.lock().map_err(lock_error)?.remove(&path)
    })
    .await
}

/// Opens a system terminal at `path`.
///
/// The program and its arguments are always passed as argv (rule 3 of
/// AGENTS.md): no building a shell command with the path interpolated,
/// which in a repo named `foo; rm -rf ~` would be a textbook injection.
#[tauri::command]
pub async fn open_terminal(path: String) -> Result<(), GitError> {
    blocking(move || {
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
    })
    .await
}

/// Opens a file or folder with the system default application.
///
/// Same argv rule as `open_terminal`: the path is never interpolated into a
/// shell command.
#[tauri::command]
pub async fn open_path(path: String) -> Result<(), GitError> {
    blocking(move || {
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
            .ok_or_else(|| {
                GitError::invalid("no application available to open the file".to_string())
            })
    })
    .await
}

/// Opens a file in Visual Studio Code.
///
/// Same argv rule as `open_terminal`/`open_path`: the binary and the file
/// are passed as argv, never through a shell. GUI apps inherit a minimal
/// PATH, so absolute install locations come before the bare name.
#[tauri::command]
pub async fn open_editor(path: String) -> Result<(), GitError> {
    blocking(move || {
        let target = Path::new(&path);
        if !target.is_file() {
            return Err(GitError::invalid(format!("path does not exist: {path}")));
        }
        let missing = || {
            GitError::invalid(
                "Visual Studio Code was not found (install it with its `code` command)".to_string(),
            )
        };
        for program in editor_programs() {
            if std::process::Command::new(&program)
                .arg(target)
                .spawn()
                .is_ok()
            {
                return Ok(());
            }
        }
        // Windows `code` is a `.cmd` shim, which only runs through `cmd`; its
        // exit code tells whether the CLI exists.
        #[cfg(target_os = "windows")]
        {
            let launched = std::process::Command::new("cmd")
                .args(["/c", "code"])
                .arg(target)
                .status()
                .map(|status| status.success())
                .unwrap_or(false);
            if launched {
                return Ok(());
            }
        }
        Err(missing())
    })
    .await
}

/// Locations of the VS Code CLI in order of preference, with the bare name
/// (whatever PATH resolves) last.
fn editor_programs() -> Vec<std::ffi::OsString> {
    let mut programs: Vec<std::ffi::OsString> = Vec::new();
    #[cfg(target_os = "macos")]
    {
        programs.extend(
            [
                "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
                "/usr/local/bin/code",
                "/opt/homebrew/bin/code",
            ]
            .map(std::ffi::OsString::from),
        );
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(mut exe) = std::env::var_os("LOCALAPPDATA").map(PathBuf::from) {
            exe.push("Programs");
            exe.push("Microsoft VS Code");
            exe.push("Code.exe");
            programs.push(exe.into_os_string());
        }
        programs.push("code".into());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        programs.extend(
            ["/usr/bin/code", "/usr/local/bin/code", "/snap/bin/code"]
                .map(std::ffi::OsString::from),
        );
    }
    programs.push("code".into());
    programs
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocking_returns_the_work_result() {
        let value = tauri::async_runtime::block_on(blocking(|| Ok::<_, GitError>(7)));
        assert_eq!(value.unwrap(), 7);
    }

    #[test]
    fn blocking_propagates_the_error() {
        let result =
            tauri::async_runtime::block_on(blocking(|| Err::<(), _>(GitError::invalid("boom"))));
        assert!(matches!(result, Err(GitError::InvalidOutput { .. })));
    }

    #[test]
    fn blocking_runs_off_the_calling_thread() {
        let caller = std::thread::current().id();
        let worker = tauri::async_runtime::block_on(blocking(|| {
            Ok::<_, GitError>(std::thread::current().id())
        }))
        .unwrap();
        assert_ne!(caller, worker);
    }

    #[test]
    fn git_error_is_send_and_static() {
        fn assert_send_static<T: Send + 'static>() {}
        assert_send_static::<GitError>();
    }
}
