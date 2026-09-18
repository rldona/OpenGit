//! Operaciones de escritura sobre el working tree y el index (OG-009).

use std::ffi::OsString;
use std::path::{Component, Path};

use crate::git::{
    error::GitError,
    runner::{GitCommand, Runner},
};

fn paths_args(files: &[&str]) -> Vec<OsString> {
    let mut args: Vec<OsString> = vec!["--".into()];
    args.extend(files.iter().map(|file| (*file).into()));
    args
}

/// `git add -A -- <paths>`: stage de ficheros nuevos, modificados o renombrados.
pub fn stage_paths(runner: &Runner, repo: &Path, files: &[&str]) -> Result<(), GitError> {
    let mut args: Vec<OsString> = vec!["add".into(), "-A".into()];
    args.extend(paths_args(files));
    runner
        .run_checked(&GitCommand::new(args).cwd(repo).write())
        .map(|_| ())
}

/// `git restore --staged -- <paths>`: devuelve el contenido del index a HEAD.
pub fn unstage_paths(runner: &Runner, repo: &Path, files: &[&str]) -> Result<(), GitError> {
    let mut args: Vec<OsString> = vec!["restore".into(), "--staged".into()];
    args.extend(paths_args(files));
    runner
        .run_checked(&GitCommand::new(args).cwd(repo).write())
        .map(|_| ())
}

/// `git restore --source=HEAD --staged --worktree -- <paths>`: descarta
/// cambios staged y unstaged de los ficheros indicados (destructivo).
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

/// Borra un fichero sin trackear, validando que la ruta es relativa al repo.
pub fn remove_untracked(repo: &Path, file: &str) -> Result<(), GitError> {
    let relative = Path::new(file);
    if relative.is_absolute()
        || relative
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::RootDir))
    {
        return Err(GitError::invalid("path outside the repository"));
    }
    std::fs::remove_file(repo.join(relative)).map_err(|error| GitError::Io {
        message: error.to_string(),
    })
}
