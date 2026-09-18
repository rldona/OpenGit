use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::State;

use crate::git::{error::GitError, runner::Runner, version::GitVersion};
use crate::repo::{self, recents::Recents, RecentRepo};

/// Estado compartido por los comandos: el runner de git y los recientes.
pub struct AppState {
    pub runner: Runner,
    pub recents: Mutex<Recents>,
}

#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn git_version(state: State<'_, AppState>) -> Result<GitVersion, GitError> {
    state.runner.version()
}

/// Valida la carpeta, devuelve la info del repo y lo añade a recientes.
#[tauri::command]
pub fn open_repo(path: String, state: State<'_, AppState>) -> Result<repo::RepoInfo, GitError> {
    let info = repo::open(&state.runner, Path::new(&path))?;
    let recent = RecentRepo {
        path: info.root.clone(),
        name: info.name.clone(),
        opened_at: now(),
    };
    state.recents.lock().map_err(lock_error)?.add(&recent)?;
    Ok(info)
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
        message: "estado interno bloqueado".into(),
    }
}

fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}
