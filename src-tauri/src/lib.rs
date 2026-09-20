pub mod commands;
pub mod git;
pub mod repo;
pub mod watch;

use std::sync::Mutex;

use tauri::Manager;

use crate::commands::AppState;
use crate::git::Runner;
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
            commands::discard_path,
            commands::delete_untracked,
            commands::recent_repos,
            commands::remove_recent_repo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
