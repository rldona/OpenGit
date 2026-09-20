pub mod commands;
pub mod git;
pub mod jobs;
pub mod menu;
pub mod repo;
pub mod watch;

use std::sync::{Arc, Mutex};

use tauri::{Emitter, Manager};

use crate::commands::AppState;
use crate::git::Runner;
use crate::jobs::JobManager;
use crate::repo::recents::Recents;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_window_event(|window, event| {
            // A closed window must not leave its watcher running (ADR-0008).
            if matches!(event, tauri::WindowEvent::Destroyed) {
                if let Some(state) = window.try_state::<AppState>() {
                    let label = window.label();
                    // Bump before removing: an in-flight `open_repo` for this
                    // window then discards its watcher instead of leaking it.
                    if let Ok(mut epochs) = state.watcher_epoch.lock() {
                        *epochs.entry(label.to_string()).or_insert(0) += 1;
                    }
                    let handle = if let Ok(mut watchers) = state.watchers.lock() {
                        watchers.remove(label)
                    } else {
                        None
                    };
                    if let Some(handle) = handle {
                        handle.stop_detached();
                    }
                }
            }
        })
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            app.set_menu(menu::build_menu(app, menu::menu_labels("en"))?)?;
            app.on_menu_event(|app, event| {
                let _ = app.emit("menu-action", event.id().as_ref().to_string());
            });
            app.manage(AppState {
                runner: Runner::locate(),
                recents: Mutex::new(Recents::new(data_dir.join("recent_repos.json"))),
                watchers: Mutex::new(std::collections::HashMap::new()),
                watcher_epoch: Mutex::new(std::collections::HashMap::new()),
                pending_repo: Mutex::new(std::collections::HashMap::new()),
                window_counter: std::sync::atomic::AtomicU64::new(0),
                jobs: Arc::new(JobManager::new()),
                data_dir,
                auto_refresh: Arc::new(std::sync::atomic::AtomicBool::new(true)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_version,
            commands::git_version,
            menu::set_menu_locale,
            commands::open_repo,
            commands::open_repo_in_new_window,
            commands::initial_repo,
            commands::init_repo,
            commands::gitignore_templates,
            commands::close_repo,
            commands::grep_worktree,
            commands::reflog,
            commands::format_patch,
            commands::apply_patch,
            commands::log_page,
            commands::list_refs,
            commands::blame_file,
            commands::status_repo,
            commands::diff_file,
            commands::untracked_file_diff,
            commands::commit_files,
            commands::diff_numstat,
            commands::compare_numstat,
            commands::compare_file,
            commands::stage_path,
            commands::unstage_path,
            commands::stage_selection,
            commands::discard_selection,
            commands::commit_message,
            commands::commit_repo,
            commands::repo_op_state,
            commands::bisect_start,
            commands::bisect_mark,
            commands::bisect_reset,
            commands::bisect_state,
            commands::branch_tracking,
            commands::checkout_ref,
            commands::create_branch,
            commands::rename_branch,
            commands::delete_branch,
            commands::rebase_plan,
            commands::interactive_rebase,
            commands::read_conflict_file,
            commands::resolve_conflict,
            commands::repo_op_abort,
            commands::repo_op_continue,
            commands::repo_op_skip,
            commands::cherry_pick,
            commands::cherry_pick_range,
            commands::revert_commit,
            commands::reset_to,
            commands::merge_branch,
            commands::image_pair,
            commands::image_blob,
            commands::tag_create,
            commands::tag_delete,
            commands::stash_list,
            commands::stash_push,
            commands::stash_apply,
            commands::stash_drop,
            commands::stash_show,
            commands::start_remote_job,
            commands::cancel_remote_job,
            commands::discard_path,
            commands::delete_untracked,
            commands::recent_repos,
            commands::remove_recent_repo,
            commands::open_terminal,
            commands::submodule_status,
            commands::submodule_update,
            commands::submodule_sync,
            commands::submodule_add,
            commands::worktree_list,
            commands::worktree_add,
            commands::worktree_remove,
            commands::lfs_status,
            commands::lfs_track,
            commands::hooks_list,
            commands::hook_read,
            commands::hook_write,
            commands::hook_set_enabled,
            commands::remote_urls,
            commands::tracking_commits,
            commands::author_ident,
            commands::config_get,
            commands::config_set,
            commands::config_unset,
            commands::ignore_exclude_path,
            commands::set_auto_refresh,
            commands::open_path,
            commands::open_editor,
            commands::remote_add,
            commands::remote_set_url,
            commands::remote_rename,
            commands::remote_remove,
            commands::git_config_path,
            commands::commit_template_read,
            commands::commit_template_write,
            commands::read_text_file,
            commands::gpg_secret_keys
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
