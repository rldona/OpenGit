pub mod commands;
pub mod git;
pub mod jobs;
pub mod repo;
pub mod watch;

use std::sync::{Arc, Mutex};

use tauri::Manager;

use crate::commands::AppState;
use crate::git::Runner;
use crate::jobs::JobManager;
use crate::repo::recents::Recents;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            app.manage(AppState {
                runner: Runner::locate(),
                recents: Mutex::new(Recents::new(data_dir.join("recent_repos.json"))),
                watcher: Mutex::new(None),
                jobs: Arc::new(JobManager::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_version,
            commands::git_version,
            commands::open_repo,
            commands::close_repo,
            commands::log_page,
            commands::list_refs,
            commands::status_repo,
            commands::diff_file,
            commands::commit_files,
            commands::diff_numstat,
            commands::stage_path,
            commands::unstage_path,
            commands::stage_selection,
            commands::commit_message,
            commands::commit_repo,
            commands::repo_op_state,
            commands::branch_tracking,
            commands::checkout_ref,
            commands::create_branch,
            commands::rename_branch,
            commands::delete_branch,
            commands::read_conflict_file,
            commands::resolve_conflict,
            commands::repo_op_abort,
            commands::repo_op_continue,
            commands::cherry_pick,
            commands::revert_commit,
            commands::reset_mixed,
            commands::tag_create,
            commands::tag_delete,
            commands::stash_list,
            commands::stash_push,
            commands::stash_apply,
            commands::stash_drop,
            commands::start_remote_job,
            commands::cancel_remote_job,
            commands::discard_path,
            commands::delete_untracked,
            commands::recent_repos,
            commands::remove_recent_repo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
