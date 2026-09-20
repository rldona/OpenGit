pub mod commands;
pub mod git;
pub mod jobs;
pub mod repo;
pub mod watch;

use std::sync::{Arc, Mutex};

use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

use crate::commands::AppState;
use crate::git::Runner;
use crate::jobs::JobManager;
use crate::repo::recents::Recents;

/// Native menu: clicks emit `menu-action` with the item id and the UI routes
/// them to the same handlers as the shortcuts. No accelerators (except the
/// Edit defaults) to avoid duplicating keyboard handling.
fn build_menu(app: &tauri::App) -> tauri::Result<()> {
    let app_menu = SubmenuBuilder::new(app, "OpenGit")
        .about(Some(AboutMetadata::default()))
        .item(&MenuItemBuilder::with_id("check-updates", "Check for Updates…").build(app)?)
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&MenuItemBuilder::with_id("open-repo", "Open Repository…").build(app)?)
        .item(&MenuItemBuilder::with_id("clone-repo", "Clone Repository…").build(app)?)
        .item(&MenuItemBuilder::with_id("create-repo", "Create Repository…").build(app)?)
        .item(&MenuItemBuilder::with_id("close-repo", "Close Repository").build(app)?)
        .separator()
        .close_window()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&MenuItemBuilder::with_id("view-status", "File Status").build(app)?)
        .item(&MenuItemBuilder::with_id("view-history", "History").build(app)?)
        .item(&MenuItemBuilder::with_id("view-diff", "Diff").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("toggle-output", "Output").build(app)?)
        .item(&MenuItemBuilder::with_id("shortcuts", "Keyboard Shortcuts").build(app)?)
        .build()?;

    let repository_menu = SubmenuBuilder::new(app, "Repository")
        .item(&MenuItemBuilder::with_id("fetch", "Fetch").build(app)?)
        .item(&MenuItemBuilder::with_id("pull", "Pull").build(app)?)
        .item(&MenuItemBuilder::with_id("push", "Push").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("merge", "Merge…").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("refresh", "Refresh").build(app)?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItemBuilder::with_id("documentation", "Documentation").build(app)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &repository_menu,
            &help_menu,
        ])
        .build()?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        let _ = app.emit("menu-action", event.id().as_ref().to_string());
    });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            build_menu(app)?;
            app.manage(AppState {
                runner: Runner::locate(),
                recents: Mutex::new(Recents::new(data_dir.join("recent_repos.json"))),
                watcher: Mutex::new(None),
                jobs: Arc::new(JobManager::new()),
                data_dir,
                auto_refresh: Arc::new(std::sync::atomic::AtomicBool::new(true)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_version,
            commands::git_version,
            commands::open_repo,
            commands::init_repo,
            commands::gitignore_templates,
            commands::close_repo,
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
            commands::revert_commit,
            commands::reset_mixed,
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
