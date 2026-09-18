//! Adaptador de git: ejecución segura del binario del sistema (ADR-0003),
//! parseo robusto de su salida y modelos tipados para la UI.

pub mod error;
pub mod models;
pub mod parsers;
pub mod patch;
pub mod runner;
pub mod version;

pub use error::GitError;
pub use models::{Commit, FileDiff, FileStatus, Ref, StatusKind, StatusReport};
pub use parsers::{parse_log, parse_numstat, parse_refs, parse_status};
pub use runner::{GitCommand, GitOutput, GitProcess, Runner, StdinMode, DEFAULT_TIMEOUT};
pub use version::{GitVersion, MINIMUM_GIT_VERSION};

use std::ffi::OsString;
use std::path::Path;

use serde::Serialize;

/// Formato de una línea de log: campos separados por `%x1f`, commits por `-z`.
pub const LOG_FORMAT: &str = "%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%D%x1f%s";
/// Formato de `for-each-ref`: campos separados por NUL.
pub const REFS_FORMAT: &str =
    "%(refname)%00%(objectname)%00%(objecttype)%00%(upstream)%00%(upstream:track)";

/// Rama actual y su relación con el upstream.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BranchTracking {
    pub current: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
}

/// En qué rama estamos y cuántos commits hay por delante/detrás del upstream.
pub fn branch_tracking(runner: &Runner, repo: &Path) -> Result<BranchTracking, GitError> {
    let current_output =
        runner.run(&GitCommand::new(["symbolic-ref", "--short", "-q", "HEAD"]).cwd(repo))?;
    let current = if current_output.success() {
        let name = current_output.stdout_lossy().trim().to_string();
        if name.is_empty() {
            None
        } else {
            Some(name)
        }
    } else {
        None
    };

    let upstream_output = runner.run(
        &GitCommand::new([
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ])
        .cwd(repo),
    )?;
    if !upstream_output.success() {
        return Ok(BranchTracking {
            current,
            upstream: None,
            ahead: 0,
            behind: 0,
        });
    }
    let upstream = upstream_output.stdout_lossy().trim().to_string();

    let counts = runner.run_checked(
        &GitCommand::new(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]).cwd(repo),
    )?;
    let text = counts.stdout_lossy();
    let mut parts = text.split_whitespace();
    let ahead = parts
        .next()
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    let behind = parts
        .next()
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);

    Ok(BranchTracking {
        current,
        upstream: Some(upstream),
        ahead,
        behind,
    })
}

fn validate_branch_name(runner: &Runner, repo: &Path, name: &str) -> Result<(), GitError> {
    let output = runner.run(&GitCommand::new(["check-ref-format", "--branch", name]).cwd(repo))?;
    if !output.success() {
        return Err(GitError::invalid(format!("invalid branch name: {name}")));
    }
    Ok(())
}

/// Checkout de una rama local o, con `track`, de una remota creando la local.
pub fn checkout_ref(
    runner: &Runner,
    repo: &Path,
    target: &str,
    track: bool,
) -> Result<(), GitError> {
    validate_branch_name(runner, repo, target)?;
    let mut args: Vec<OsString> = vec!["checkout".into()];
    if track {
        args.push("--track".into());
    }
    args.push(target.into());
    runner
        .run_checked(&GitCommand::new(args).cwd(repo).write())
        .map(|_| ())
}

/// Crea una rama en un punto de partida (hash o ref).
pub fn create_branch(
    runner: &Runner,
    repo: &Path,
    name: &str,
    start_point: &str,
) -> Result<(), GitError> {
    validate_branch_name(runner, repo, name)?;
    let args: Vec<OsString> = vec![
        "branch".into(),
        "--".into(),
        name.into(),
        start_point.into(),
    ];
    runner
        .run_checked(&GitCommand::new(args).cwd(repo).write())
        .map(|_| ())
}

pub fn rename_branch(runner: &Runner, repo: &Path, old: &str, new: &str) -> Result<(), GitError> {
    validate_branch_name(runner, repo, new)?;
    runner
        .run_checked(
            &GitCommand::new(["branch", "-m", old, new])
                .cwd(repo)
                .write(),
        )
        .map(|_| ())
}

/// `force = false` usa `-d`; `-D` solo tras confirmación explícita en la UI.
pub fn delete_branch(
    runner: &Runner,
    repo: &Path,
    name: &str,
    force: bool,
) -> Result<(), GitError> {
    validate_branch_name(runner, repo, name)?;
    let flag = if force { "-D" } else { "-d" };
    runner
        .run_checked(&GitCommand::new(["branch", flag, name]).cwd(repo).write())
        .map(|_| ())
}

/// Resultado de crear un commit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CommitResult {
    pub hash: String,
    pub subject: String,
}

/// Operación de git a medias en el repo (merge, rebase, cherry-pick/revert).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct RepoOpState {
    pub merge: bool,
    pub rebase: bool,
    pub cherry_pick: bool,
}

/// Mensaje del último commit, para precargar el amend.
pub fn last_commit_message(runner: &Runner, repo: &Path) -> Result<String, GitError> {
    let output = runner.run_checked(&GitCommand::new(["log", "-1", "--format=%B"]).cwd(repo))?;
    Ok(output.stdout_lossy().trim_end().to_string())
}

/// Crea el commit con el mensaje por stdin (nunca interpolado en `-m`).
/// No se pasa `--no-verify`: los hooks del usuario mandan.
pub fn commit(
    runner: &Runner,
    repo: &Path,
    message: &str,
    amend: bool,
) -> Result<CommitResult, GitError> {
    let mut args: Vec<OsString> = vec!["commit".into(), "--file=-".into()];
    if amend {
        args.push("--amend".into());
    }
    let output = runner.run(
        &GitCommand::new(args.clone())
            .cwd(repo)
            .write()
            .stdin_bytes(message.as_bytes().to_vec()),
    )?;
    if !output.success() {
        return Err(GitError::CommandFailed {
            exit_code: output.exit_code(),
            stdout: output.stdout_lossy(),
            stderr: output.stderr_lossy(),
            args: args
                .iter()
                .map(|arg| arg.to_string_lossy().into_owned())
                .collect(),
        });
    }
    let hash = runner
        .run_checked(&GitCommand::new(["rev-parse", "--short", "HEAD"]).cwd(repo))?
        .stdout_lossy()
        .trim()
        .to_string();
    let subject = runner
        .run_checked(&GitCommand::new(["log", "-1", "--format=%s"]).cwd(repo))?
        .stdout_lossy()
        .trim()
        .to_string();
    Ok(CommitResult { hash, subject })
}

/// Detecta merge, rebase o cherry-pick/revert en curso.
pub fn repo_op_state(runner: &Runner, repo: &Path) -> Result<RepoOpState, GitError> {
    let git_dir = runner
        .run_checked(&GitCommand::new(["rev-parse", "--git-dir"]).cwd(repo))?
        .stdout_lossy()
        .trim()
        .to_string();
    let git_dir = if Path::new(&git_dir).is_absolute() {
        std::path::PathBuf::from(git_dir)
    } else {
        repo.join(git_dir)
    };
    Ok(RepoOpState {
        merge: git_dir.join("MERGE_HEAD").exists(),
        rebase: git_dir.join("rebase-merge").exists() || git_dir.join("rebase-apply").exists(),
        cherry_pick: git_dir.join("CHERRY_PICK_HEAD").exists()
            || git_dir.join("REVERT_HEAD").exists(),
    })
}

/// Página de historial en orden topológico. Con `rev = None` recorre todas las
/// refs; con `Some(rev)` solo la rama o ref indicada.
pub fn log_page(
    runner: &Runner,
    repo: &Path,
    skip: usize,
    limit: usize,
    rev: Option<&str>,
) -> Result<Vec<Commit>, GitError> {
    let mut args: Vec<OsString> = vec![
        "log".into(),
        "--topo-order".into(),
        "--parents".into(),
        "-z".into(),
        format!("--format={LOG_FORMAT}").into(),
        format!("--skip={skip}").into(),
        format!("--max-count={limit}").into(),
    ];
    match rev {
        Some(rev) => {
            // Evita que una ref que empiece por "-" se interprete como opción.
            args.push("--end-of-options".into());
            args.push(rev.into());
        }
        None => args.push("--all".into()),
    }
    let output = runner.run_checked(&GitCommand::new(args).cwd(repo))?;
    parse_log(&output.stdout)
}

/// True si HEAD apunta a un commit (repo con historial).
pub fn has_commits(runner: &Runner, repo: &Path) -> Result<bool, GitError> {
    let cmd = GitCommand::new(["rev-parse", "--verify", "--quiet", "HEAD"]).cwd(repo);
    Ok(runner.run(&cmd)?.success())
}

/// Estado del working tree con cabecera de rama.
pub fn status(runner: &Runner, repo: &Path) -> Result<StatusReport, GitError> {
    let cmd = GitCommand::new([
        "status",
        "--porcelain=v2",
        "-z",
        "--branch",
        "--untracked-files=all",
    ])
    .cwd(repo);
    let output = runner.run_checked(&cmd)?;
    parse_status(&output.stdout)
}

/// Branches locales, remotas y tags.
pub fn refs(runner: &Runner, repo: &Path) -> Result<Vec<Ref>, GitError> {
    let args: Vec<OsString> = vec![
        "for-each-ref".into(),
        format!("--format={REFS_FORMAT}").into(),
        "refs/heads".into(),
        "refs/remotes".into(),
        "refs/tags".into(),
    ];
    let output = runner.run_checked(&GitCommand::new(args).cwd(repo))?;
    parse_refs(&output.stdout)
}

/// Cambios por fichero con detección de renombrados; `cached` compara el index con HEAD.
pub fn diff_numstat(runner: &Runner, repo: &Path, cached: bool) -> Result<Vec<FileDiff>, GitError> {
    let mut args: Vec<OsString> = vec!["diff".into(), "--numstat".into(), "-z".into(), "-M".into()];
    if cached {
        args.push("--cached".into());
    }
    let output = runner.run_checked(&GitCommand::new(args).cwd(repo))?;
    parse_numstat(&output.stdout)
}

/// Ficheros tocados por un commit (numstat con renombrados).
pub fn commit_files(runner: &Runner, repo: &Path, rev: &str) -> Result<Vec<FileDiff>, GitError> {
    let args: Vec<OsString> = vec![
        "diff-tree".into(),
        "--no-commit-id".into(),
        "--numstat".into(),
        "-z".into(),
        "-r".into(),
        "-M".into(),
        "--root".into(),
        "--end-of-options".into(),
        rev.into(),
    ];
    let output = runner.run_checked(&GitCommand::new(args).cwd(repo))?;
    parse_numstat(&output.stdout)
}

/// Parche de un fichero del working tree o del index (`staged`), opcionalmente
/// invertido (`-R`) para el "reverse hunk".
pub fn worktree_file_diff(
    runner: &Runner,
    repo: &Path,
    file: &str,
    staged: bool,
    reversed: bool,
) -> Result<String, GitError> {
    let mut args: Vec<OsString> = vec![
        "diff".into(),
        "--no-color".into(),
        "--no-ext-diff".into(),
        "-M".into(),
    ];
    if staged {
        args.push("--cached".into());
    }
    if reversed {
        args.push("-R".into());
    }
    args.push("--".into());
    args.push(file.into());
    let output = runner.run_checked(&GitCommand::new(args).cwd(repo))?;
    Ok(output.stdout_lossy())
}

/// Parche de un fichero del working tree o del index, en bytes.
pub fn worktree_diff_bytes(
    runner: &Runner,
    repo: &Path,
    file: &str,
    staged: bool,
) -> Result<Vec<u8>, GitError> {
    let mut args: Vec<OsString> = vec![
        "diff".into(),
        "--no-color".into(),
        "--no-ext-diff".into(),
        "-M".into(),
    ];
    if staged {
        args.push("--cached".into());
    }
    args.push("--".into());
    args.push(file.into());
    let output = runner.run_checked(&GitCommand::new(args).cwd(repo))?;
    Ok(output.stdout)
}

/// Aplica un parche al index por stdin (nunca por fichero temporal).
pub fn apply_index_patch(
    runner: &Runner,
    repo: &Path,
    patch: &[u8],
    reverse: bool,
) -> Result<(), GitError> {
    let mut args: Vec<OsString> = vec![
        "apply".into(),
        "--cached".into(),
        "--recount".into(),
        "--whitespace=nowarn".into(),
    ];
    if reverse {
        args.push("--reverse".into());
    }
    args.push("-".into());
    runner
        .run_checked(
            &GitCommand::new(args)
                .cwd(repo)
                .write()
                .stdin_bytes(patch.to_vec()),
        )
        .map(|_| ())
}

/// Stage/unstage parcial: fichero completo o una selección de hunks/líneas.
pub fn stage_selection(
    runner: &Runner,
    repo: &Path,
    file: &str,
    staged: bool,
    selection: &patch::HunkSelection,
    reverse: bool,
) -> Result<(), GitError> {
    if matches!(selection, patch::HunkSelection::File) {
        return if reverse {
            crate::repo::ops::unstage_paths(runner, repo, &[file])
        } else {
            crate::repo::ops::stage_paths(runner, repo, &[file])
        };
    }
    let data = worktree_diff_bytes(runner, repo, file, staged)?;
    let parsed = patch::parse(&data);
    let Some(built) = parsed.build(selection)? else {
        return Ok(());
    };
    apply_index_patch(runner, repo, &built, reverse)
}

/// Parche de un fichero dentro de un commit (funciona también en el commit raíz).
pub fn commit_file_diff(
    runner: &Runner,
    repo: &Path,
    rev: &str,
    file: &str,
    reversed: bool,
) -> Result<String, GitError> {
    let mut args: Vec<OsString> = vec![
        "show".into(),
        "--no-color".into(),
        "--no-ext-diff".into(),
        "-M".into(),
        "--format=".into(),
    ];
    if reversed {
        args.push("-R".into());
    }
    args.push("--end-of-options".into());
    args.push(rev.into());
    args.push("--".into());
    args.push(file.into());
    let output = runner.run_checked(&GitCommand::new(args).cwd(repo))?;
    Ok(output.stdout_lossy())
}
