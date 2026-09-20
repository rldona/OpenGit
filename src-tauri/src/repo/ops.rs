//! Write operations on the working tree and the index (OG-009).

use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};

use crate::git::{
    error::GitError,
    runner::{GitCommand, Runner},
};

fn paths_args(files: &[&str]) -> Vec<OsString> {
    let mut args: Vec<OsString> = vec!["--".into()];
    args.extend(files.iter().map(|file| (*file).into()));
    args
}

/// `git add -A -- <paths>`: stages new, modified or renamed files.
pub fn stage_paths(runner: &Runner, repo: &Path, files: &[&str]) -> Result<(), GitError> {
    let mut args: Vec<OsString> = vec!["add".into(), "-A".into()];
    args.extend(paths_args(files));
    runner
        .run_checked(&GitCommand::new(args).cwd(repo).write())
        .map(|_| ())
}

/// `git restore --staged -- <paths>`: resets the index content to HEAD.
pub fn unstage_paths(runner: &Runner, repo: &Path, files: &[&str]) -> Result<(), GitError> {
    let mut args: Vec<OsString> = vec!["restore".into(), "--staged".into()];
    args.extend(paths_args(files));
    runner
        .run_checked(&GitCommand::new(args).cwd(repo).write())
        .map(|_| ())
}

/// `git restore --source=HEAD --staged --worktree -- <paths>`: discards
/// staged and unstaged changes of the given files (destructive).
pub fn discard_paths(runner: &Runner, repo: &Path, files: &[&str]) -> Result<(), GitError> {
    let mut args: Vec<OsString> = vec![
        "restore".into(),
        "--source=HEAD".into(),
        "--staged".into(),
        "--worktree".into(),
    ];
    args.extend(paths_args(files));
    runner
        .run_checked(&GitCommand::new(args).cwd(repo).write())
        .map(|_| ())
}

pub(crate) fn relative_path(file: &str) -> Result<PathBuf, GitError> {
    let relative = Path::new(file);
    if relative.is_absolute()
        || relative
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::RootDir))
    {
        return Err(GitError::invalid("path outside the repository"));
    }
    Ok(relative.to_path_buf())
}

/// Deletes an untracked file, validating that the path is repo-relative.
pub fn remove_untracked(repo: &Path, file: &str) -> Result<(), GitError> {
    let relative = relative_path(file)?;
    std::fs::remove_file(repo.join(relative)).map_err(|error| GitError::Io {
        message: error.to_string(),
    })
}

/// Reads a working-tree file; `binary = true` when it is not UTF-8.
pub fn read_worktree_file(repo: &Path, file: &str) -> Result<(String, bool), GitError> {
    let relative = relative_path(file)?;
    let bytes = std::fs::read(repo.join(relative)).map_err(|error| GitError::Io {
        message: error.to_string(),
    })?;
    match String::from_utf8(bytes) {
        Ok(content) => Ok((content, false)),
        Err(_) => Ok((String::new(), true)),
    }
}

/// Writes the resolved content and stages it into the index.
pub fn write_and_stage(
    runner: &Runner,
    repo: &Path,
    file: &str,
    content: &str,
) -> Result<(), GitError> {
    let relative = relative_path(file)?;
    std::fs::write(repo.join(relative), content.as_bytes()).map_err(|error| GitError::Io {
        message: error.to_string(),
    })?;
    stage_paths(runner, repo, &[file])
}
