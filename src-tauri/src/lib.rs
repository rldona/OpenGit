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

/// Menú nativo: los clics emiten `menu-action` con el id del ítem y la UI los
/// enruta a los mismos handlers que los atajos. Sin aceleradores (salvo los
/// predefinidos de Edit) para no duplicar la gestión del teclado.
fn build_menu(app: &tauri::App) -> tauri::Result<()> {
    let app_menu = SubmenuBuilder::new(app, "OpenGit")
        .about(Some(AboutMetadata::default()))
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&MenuItemBuilder::with_id("open-repo", "Open Repository…").build(app)?)
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
            commands::worktree_list,
            commands::lfs_status,
            commands::remote_urls,
            commands::tracking_commits,
            commands::author_ident
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
