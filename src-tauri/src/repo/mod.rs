//! Repository opening and validation (OG-002) and persistence of recents.

pub mod ops;
pub mod recents;

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::git::{
    error::GitError,
    runner::{GitCommand, Runner},
};

pub use recents::RecentRepo;

/// Information about an open repository, ready for the UI.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RepoInfo {
    /// Working tree root (may be a folder above the one picked).
    pub root: String,
    /// Name of the root folder.
    pub name: String,
    pub has_commits: bool,
    /// Current branch; `None` on detached HEAD or a repo without commits.
    pub branch: Option<String>,
    pub detached: bool,
    /// HEAD OID; `None` if the repo has no commits yet.
    pub head: Option<String>,
    pub git_version: String,
}

/// Validates the path and returns the repository information.
pub fn open(runner: &Runner, path: &Path) -> Result<RepoInfo, GitError> {
    if !path.is_dir() {
        return Err(GitError::PathNotFound {
            path: path.display().to_string(),
        });
    }

    let version = runner.version()?;
    if !version.meets_minimum() {
        return Err(GitError::GitTooOld {
            found: version.to_string(),
            minimum: crate::git::MINIMUM_GIT_VERSION.to_string(),
        });
    }

    let path_label = path.display().to_string();
    let inside = runner.run(&GitCommand::new(["rev-parse", "--is-inside-work-tree"]).cwd(path))?;
    if !inside.success() {
        return Err(GitError::NotARepository { path: path_label });
    }
    if inside.stdout_lossy().trim() != "true" {
        return Err(GitError::NotAWorkTree { path: path_label });
    }

    let root_output =
        runner.run_checked(&GitCommand::new(["rev-parse", "--show-toplevel"]).cwd(path))?;
    let root = root_output.stdout_lossy().trim().to_string();
    let root_path = PathBuf::from(&root);
    let name = root_path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| root.clone());

    let has_commits = crate::git::has_commits(runner, &root_path)?;
    let (branch, detached, head) = head_info(runner, &root_path, &root)?;

    Ok(RepoInfo {
        root,
        name,
        has_commits,
        branch,
        detached,
        head,
        git_version: version.to_string(),
    })
}

fn head_info(
    runner: &Runner,
    repo: &Path,
    label: &str,
) -> Result<(Option<String>, bool, Option<String>), GitError> {
    let symbolic =
        runner.run(&GitCommand::new(["symbolic-ref", "--short", "-q", "HEAD"]).cwd(repo))?;
    if symbolic.success() {
        let branch = symbolic.stdout_lossy().trim().to_string();
        let head = rev_parse(runner, repo, "HEAD")?;
        return Ok((Some(branch), false, head));
    }

    match rev_parse(runner, repo, "HEAD")? {
        Some(head) => Ok((None, true, Some(head))),
        None => Err(GitError::InvalidHead {
            path: label.to_string(),
        }),
    }
}

fn rev_parse(runner: &Runner, repo: &Path, rev: &str) -> Result<Option<String>, GitError> {
    let output =
        runner.run(&GitCommand::new(["rev-parse", "--verify", "--quiet", rev]).cwd(repo))?;
    if !output.success() {
        return Ok(None);
    }
    let value = output.stdout_lossy().trim().to_string();
    Ok(if value.is_empty() { None } else { Some(value) })
}
