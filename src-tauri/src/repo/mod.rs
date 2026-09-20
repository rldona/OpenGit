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

/// `.gitignore` template offered when creating a repository (OG-086).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GitignoreTemplate {
    pub id: String,
    pub name: String,
}

const GITIGNORE_TEMPLATES: &[(&str, &str, &str)] = &[
    (
        "node",
        "Node.js",
        include_str!("../../templates/gitignore/node.txt"),
    ),
    (
        "rust",
        "Rust",
        include_str!("../../templates/gitignore/rust.txt"),
    ),
    (
        "python",
        "Python",
        include_str!("../../templates/gitignore/python.txt"),
    ),
    ("go", "Go", include_str!("../../templates/gitignore/go.txt")),
];

/// Templates for the "Create repository" dialog.
pub fn gitignore_templates() -> Vec<GitignoreTemplate> {
    GITIGNORE_TEMPLATES
        .iter()
        .map(|(id, name, _)| GitignoreTemplate {
            id: (*id).to_string(),
            name: (*name).to_string(),
        })
        .collect()
}

fn gitignore_content(id: &str) -> Option<&'static str> {
    GITIGNORE_TEMPLATES
        .iter()
        .find(|(template_id, _, _)| *template_id == id)
        .map(|(_, _, content)| *content)
}

/// Creates a repository at `path` with an initial branch, an optional
/// `.gitignore` template and an optional first commit.
pub fn init(
    runner: &Runner,
    path: &Path,
    branch: &str,
    template: Option<&str>,
    initial_commit: bool,
) -> Result<(), GitError> {
    if branch.trim().is_empty() {
        return Err(GitError::invalid("the initial branch name is required"));
    }

    let parent = if path.exists() {
        if !path.is_dir() {
            return Err(GitError::invalid(
                "the destination exists and is not a folder",
            ));
        }
        let mut entries = std::fs::read_dir(path).map_err(|error| {
            GitError::invalid(format!("could not read the destination: {error}"))
        })?;
        if entries.next().is_some() {
            return Err(GitError::invalid("the destination folder is not empty"));
        }
        path.parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."))
    } else {
        let parent = path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .ok_or_else(|| GitError::invalid("the destination needs a parent folder"))?;
        if !parent.is_dir() {
            return Err(GitError::invalid(
                "the destination's parent folder does not exist",
            ));
        }
        parent.to_path_buf()
    };

    crate::git::validate_ref_name(runner, &parent, branch)?;

    let mut args: Vec<std::ffi::OsString> = vec!["init".into(), "-b".into(), branch.into()];
    args.push(path.as_os_str().to_os_string());
    runner.run_checked(&GitCommand::new(args).cwd(&parent).write())?;

    if let Some(content) = template.and_then(gitignore_content) {
        std::fs::write(path.join(".gitignore"), content)
            .map_err(|error| GitError::invalid(format!("could not write .gitignore: {error}")))?;
    }

    if initial_commit {
        crate::git::author_ident(runner, path).map_err(|_| {
            GitError::invalid(
                "configure your name and email in Settings before creating the first commit",
            )
        })?;
        runner.run_checked(&GitCommand::new(["add", "-A"]).cwd(path).write())?;
        runner.run_checked(
            &GitCommand::new(["commit", "--allow-empty", "-m", "Initial commit"])
                .cwd(path)
                .write(),
        )?;
    }

    Ok(())
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
