use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::git::error::GitError;

const MAX_RECENTS: usize = 10;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecentRepo {
    pub path: String,
    pub name: String,
    /// UNIX timestamp of the last open.
    pub opened_at: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct RecentFile {
    repos: Vec<RecentRepo>,
}

/// Recent repositories list persisted as JSON in the app data folder,
/// never inside the user's repository.
pub struct Recents {
    file: PathBuf,
}

impl Recents {
    pub fn new(file: impl Into<PathBuf>) -> Self {
        Self { file: file.into() }
    }

    pub fn list(&self) -> Vec<RecentRepo> {
        load(&self.file).repos
    }

    /// Inserts or moves to the front; no duplicates and a capped number of entries.
    pub fn add(&self, repo: &RecentRepo) -> Result<(), GitError> {
        let mut data = load(&self.file);
        data.repos.retain(|item| item.path != repo.path);
        data.repos.insert(0, repo.clone());
        data.repos.truncate(MAX_RECENTS);
        save(&self.file, &data)
    }

    pub fn remove(&self, path: &str) -> Result<(), GitError> {
        let mut data = load(&self.file);
        data.repos.retain(|item| item.path != path);
        save(&self.file, &data)
    }
}

fn load(file: &Path) -> RecentFile {
    fs::read_to_string(file)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn save(file: &Path, data: &RecentFile) -> Result<(), GitError> {
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(store_error)?;
    }
    let text = serde_json::to_string_pretty(data).map_err(|error| GitError::Store {
        message: error.to_string(),
    })?;
    fs::write(file, text).map_err(store_error)
}

fn store_error(error: std::io::Error) -> GitError {
    GitError::Store {
        message: error.to_string(),
    }
}
