//! Adaptador de git: ejecución segura del binario del sistema (ADR-0003),
//! parseo robusto de su salida y modelos tipados para la UI.

pub mod error;
pub mod models;
pub mod parsers;
pub mod patch;
pub mod runner;
pub mod version;

pub use error::GitError;
pub use models::{Commit, FileDiff, FileStatus, Ref, Stash, StatusKind, StatusReport};
pub use parsers::{parse_log, parse_numstat, parse_refs, parse_stash_list, parse_status};
pub use runner::{GitCommand, GitOutput, GitProcess, Runner, StdinMode, DEFAULT_TIMEOUT};
pub use version::{GitVersion, MINIMUM_GIT_VERSION};

use std::ffi::OsString;
use std::path::Path;
use std::time::Duration;

use serde::{Deserialize, Serialize};

/// Formato de una línea de log: campos separados por `%x1f`, commits por `-z`.
pub const LOG_FORMAT: &str = "%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%D%x1f%s";
/// Formato de `for-each-ref`: campos separados por NUL.
pub const REFS_FORMAT: &str =
    "%(refname)%00%(objectname)%00%(objecttype)%00%(upstream)%00%(upstream:track)";

/// Commit del plan de rebase interactivo.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PlanCommit {
    pub hash: String,
    pub short: String,
    pub subject: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TodoAction {
    Pick,
    Reword,
    Squash,
    Fixup,
    Drop,
}

impl TodoAction {
    /// Acción que se escribe en el todo-list de git.
    fn as_git(self) -> &'static str {
        match self {
            // El reword se resuelve con `exec git commit --amend -F` después del pick.
            Self::Pick | Self::Reword => "pick",
            Self::Squash => "squash",
            Self::Fixup => "fixup",
            Self::Drop => "drop",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct TodoItem {
    pub hash: String,
    pub action: TodoAction,
}

/// Commits de `base..HEAD` en orden cronológico (el que se reescribe primero).
pub fn rebase_plan(runner: &Runner, repo: &Path, base: &str) -> Result<Vec<PlanCommit>, GitError> {
    validate_commit_hash(base)?;
    let args: Vec<OsString> = vec![
        "log".into(),
        "--reverse".into(),
        "--format=%H%x1f%s".into(),
        "--end-of-options".into(),
        format!("{base}..HEAD").into(),
    ];
    let output = runner.run_checked(&GitCommand::new(args).cwd(repo))?;
    let mut plan = Vec::new();
    for line in output.stdout_lossy().lines() {
        if line.is_empty() {
            continue;
        }
        let (hash, subject) = line.split_once('\u{1f}').unwrap_or((line, ""));
        let short = hash.chars().take(12).collect::<String>();
        plan.push(PlanCommit {
            hash: hash.to_string(),
            short,
            subject: subject.to_string(),
        });
    }
    Ok(plan)
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

/// Ejecuta el rebase interactivo inyectando el todo-list con `GIT_SEQUENCE_EDITOR`.
/// El fichero vive en el directorio de datos de la app, nunca en el repo.
pub fn interactive_rebase(
    runner: &Runner,
    repo: &Path,
    data_dir: &Path,
    base: &str,
    todos: &[TodoItem],
    reword_message: Option<&str>,
) -> Result<(), GitError> {
    validate_commit_hash(base)?;
    if todos.is_empty() {
        return Err(GitError::invalid("rebase plan is empty"));
    }
    for item in todos {
        validate_commit_hash(&item.hash)?;
    }

    let rewords = todos
        .iter()
        .filter(|item| item.action == TodoAction::Reword)
        .count();
    if rewords > 1 {
        return Err(GitError::invalid("only one reword is supported"));
    }
    let message = reword_message.map(str::trim).unwrap_or("");
    if rewords == 1 && message.is_empty() {
        return Err(GitError::invalid("reword needs a message"));
    }

    std::fs::create_dir_all(data_dir).map_err(|error| GitError::Io {
        message: error.to_string(),
    })?;

    let mut todo = String::new();
    for item in todos {
        todo.push_str(item.action.as_git());
        todo.push(' ');
        todo.push_str(&item.hash);
        todo.push('\n');
        if item.action == TodoAction::Reword {
            let message_file = data_dir.join("rebase-message.txt");
            std::fs::write(&message_file, message).map_err(|error| GitError::Io {
                message: error.to_string(),
            })?;
            todo.push_str("exec git commit --amend -F ");
            todo.push_str(&shell_quote(&message_file.display().to_string()));
            todo.push('\n');
        }
    }

    let todo_file = data_dir.join("rebase-todo.txt");
    std::fs::write(&todo_file, todo).map_err(|error| GitError::Io {
        message: error.to_string(),
    })?;

    runner
        .run_checked(
            &GitCommand::new(["rebase", "-i", base])
                .cwd(repo)
                .write()
                .timeout(Duration::from_secs(600))
                .env(
                    "GIT_SEQUENCE_EDITOR",
                    format!("cp {}", shell_quote(&todo_file.display().to_string())),
                )
                .env("GIT_EDITOR", "true"),
        )
        .map(|_| ())
}

fn validate_commit_hash(hash: &str) -> Result<(), GitError> {
    let valid = (4..=64).contains(&hash.len()) && hash.chars().all(|c| c.is_ascii_hexdigit());
    if !valid {
        return Err(GitError::invalid(format!("invalid commit hash: {hash}")));
    }
    Ok(())
}

/// Aplica el commit indicado sobre la rama actual.
pub fn cherry_pick(runner: &Runner, repo: &Path, hash: &str) -> Result<(), GitError> {
    validate_commit_hash(hash)?;
    runner
        .run_checked(&GitCommand::new(["cherry-pick", hash]).cwd(repo).write())
        .map(|_| ())
}

/// Crea el commit de reversión del commit indicado (mensaje por defecto).
pub fn revert_commit(runner: &Runner, repo: &Path, hash: &str) -> Result<(), GitError> {
    validate_commit_hash(hash)?;
    runner
        .run_checked(
            &GitCommand::new(["revert", "--no-edit", hash])
                .cwd(repo)
                .write(),
        )
        .map(|_| ())
}

/// Reset mixed: mueve HEAD y desestagea, sin tocar el working tree.
pub fn reset_mixed(runner: &Runner, repo: &Path, hash: &str) -> Result<(), GitError> {
    validate_commit_hash(hash)?;
    runner
        .run_checked(
            &GitCommand::new(["reset", "--mixed", hash])
                .cwd(repo)
                .write(),
        )
        .map(|_| ())
}

/// Crea un tag ligero (sin mensaje) o anotado (con mensaje) en `target`.
pub fn tag_create(
    runner: &Runner,
    repo: &Path,
    name: &str,
    target: &str,
    message: Option<&str>,
) -> Result<(), GitError> {
    validate_ref_name(runner, repo, name)?;
    let mut args: Vec<OsString> = vec!["tag".into()];
    match message {
        Some(message) if !message.trim().is_empty() => {
            args.push("-a".into());
            args.push(name.into());
            args.push("-m".into());
            args.push(message.into());
        }
        _ => args.push(name.into()),
    }
    args.push(target.into());
    runner
        .run_checked(&GitCommand::new(args).cwd(repo).write())
        .map(|_| ())
}

pub fn tag_delete(runner: &Runner, repo: &Path, name: &str) -> Result<(), GitError> {
    validate_ref_name(runner, repo, name)?;
    runner
        .run_checked(&GitCommand::new(["tag", "-d", name]).cwd(repo).write())
        .map(|_| ())
}

/// Lista los stashes con su referencia, mensaje, fecha y commit.
pub fn stash_list(runner: &Runner, repo: &Path) -> Result<Vec<Stash>, GitError> {
    let output = runner.run_checked(
        &GitCommand::new(["stash", "list", "-z", "--format=%gd%x1f%gs%x1f%ct%x1f%H"]).cwd(repo),
    )?;
    parse_stash_list(&output.stdout)
}

pub fn stash_push(
    runner: &Runner,
    repo: &Path,
    message: Option<&str>,
    include_untracked: bool,
) -> Result<(), GitError> {
    let mut args: Vec<OsString> = vec!["stash".into(), "push".into()];
    if include_untracked {
        args.push("--include-untracked".into());
    }
    if let Some(message) = message {
        if !message.trim().is_empty() {
            args.push("-m".into());
            args.push(message.into());
        }
    }
    runner
        .run_checked(&GitCommand::new(args).cwd(repo).write())
        .map(|_| ())
}

/// Aplica un stash; con `drop` usa `pop` (solo lo borra si aplica bien).
pub fn stash_apply(
    runner: &Runner,
    repo: &Path,
    reference: &str,
    drop: bool,
) -> Result<(), GitError> {
    validate_stash_reference(reference)?;
    let verb = if drop { "pop" } else { "apply" };
    runner
        .run_checked(
            &GitCommand::new(["stash", verb, reference])
                .cwd(repo)
                .write(),
        )
        .map(|_| ())
}

pub fn stash_drop(runner: &Runner, repo: &Path, reference: &str) -> Result<(), GitError> {
    validate_stash_reference(reference)?;
    runner
        .run_checked(
            &GitCommand::new(["stash", "drop", reference])
                .cwd(repo)
                .write(),
        )
        .map(|_| ())
}

fn validate_stash_reference(reference: &str) -> Result<(), GitError> {
    let inner = reference
        .strip_prefix("stash@{")
        .and_then(|rest| rest.strip_suffix('}'))
        .ok_or_else(|| GitError::invalid(format!("invalid stash reference: {reference}")))?;
    if inner.is_empty() || !inner.chars().all(|character| character.is_ascii_digit()) {
        return Err(GitError::invalid(format!(
            "invalid stash reference: {reference}"
        )));
    }
    Ok(())
}

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

pub(crate) fn validate_ref_name(runner: &Runner, repo: &Path, name: &str) -> Result<(), GitError> {
    let output = runner.run(&GitCommand::new(["check-ref-format", "--branch", name]).cwd(repo))?;
    if !output.success() {
        return Err(GitError::invalid(format!("invalid ref name: {name}")));
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
    validate_ref_name(runner, repo, target)?;
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
    validate_ref_name(runner, repo, name)?;
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
    validate_ref_name(runner, repo, new)?;
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
    validate_ref_name(runner, repo, name)?;
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

/// Operación de git a medias en el repo (merge, rebase, cherry-pick/revert),
/// con el paso actual cuando es un rebase.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct RepoOpState {
    pub merge: bool,
    pub rebase: bool,
    pub cherry_pick: bool,
    pub revert: bool,
    pub rebase_current: Option<u32>,
    pub rebase_total: Option<u32>,
}

impl RepoOpState {
    pub fn operation(&self) -> Option<&'static str> {
        if self.rebase {
            Some("rebase")
        } else if self.merge {
            Some("merge")
        } else if self.cherry_pick {
            Some("cherry-pick")
        } else if self.revert {
            Some("revert")
        } else {
            None
        }
    }

    pub fn is_clean(&self) -> bool {
        self.operation().is_none()
    }
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

fn read_number(path: std::path::PathBuf) -> Option<u32> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|text| text.trim().parse().ok())
}

/// Detecta merge, rebase o cherry-pick/revert en curso, con el paso del rebase.
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

    let rebase_merge = git_dir.join("rebase-merge");
    let rebase_apply = git_dir.join("rebase-apply");
    let rebase_dir = if rebase_merge.is_dir() {
        Some(rebase_merge)
    } else if rebase_apply.is_dir() {
        Some(rebase_apply)
    } else {
        None
    };
    let rebase_active = rebase_dir.is_some();
    let (rebase_current, rebase_total) = match rebase_dir {
        Some(dir) => (
            read_number(dir.join("msgnum")).or_else(|| read_number(dir.join("next"))),
            read_number(dir.join("end")).or_else(|| read_number(dir.join("last"))),
        ),
        None => (None, None),
    };

    Ok(RepoOpState {
        merge: git_dir.join("MERGE_HEAD").exists(),
        rebase: rebase_active,
        cherry_pick: git_dir.join("CHERRY_PICK_HEAD").exists(),
        revert: git_dir.join("REVERT_HEAD").exists(),
        rebase_current,
        rebase_total,
    })
}

/// Cancela la operación en curso (merge, rebase, cherry-pick o revert).
pub fn repo_op_abort(runner: &Runner, repo: &Path) -> Result<(), GitError> {
    let state = repo_op_state(runner, repo)?;
    let operation = state
        .operation()
        .ok_or_else(|| GitError::invalid("no operation in progress"))?;
    runner
        .run_checked(&GitCommand::new([operation, "--abort"]).cwd(repo).write())
        .map(|_| ())
}

/// Continúa la operación en curso aceptando el mensaje por defecto.
pub fn repo_op_continue(runner: &Runner, repo: &Path) -> Result<(), GitError> {
    let state = repo_op_state(runner, repo)?;
    let operation = state
        .operation()
        .ok_or_else(|| GitError::invalid("no operation in progress"))?;
    runner
        .run_checked(
            &GitCommand::new([operation, "--continue"])
                .cwd(repo)
                .write()
                .env("GIT_EDITOR", "true"),
        )
        .map(|_| ())
}

/// Filtros de búsqueda del historial (literal, sin regex).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct LogSearch {
    pub grep: Option<String>,
    pub author: Option<String>,
    pub path: Option<String>,
}

impl LogSearch {
    pub fn is_empty(&self) -> bool {
        [
            self.grep.as_deref(),
            self.author.as_deref(),
            self.path.as_deref(),
        ]
        .into_iter()
        .all(|value| value.map(str::trim).unwrap_or("").is_empty())
    }
}

fn push_search_pattern(args: &mut Vec<OsString>, flag: &str, pattern: Option<&str>) {
    if let Some(pattern) = pattern.map(str::trim).filter(|value| !value.is_empty()) {
        args.push("--fixed-strings".into());
        args.push("--regexp-ignore-case".into());
        args.push(format!("--{flag}={pattern}").into());
    }
}

/// Página de historial en orden topológico. Con `rev = None` recorre todas las
/// refs; con `search` filtra por mensaje, autor y/o ruta (de forma literal).
pub fn log_page(
    runner: &Runner,
    repo: &Path,
    skip: usize,
    limit: usize,
    rev: Option<&str>,
    search: Option<&LogSearch>,
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

    let search = search.filter(|filter| !filter.is_empty());
    if let Some(search) = search {
        push_search_pattern(&mut args, "grep", search.grep.as_deref());
        push_search_pattern(&mut args, "author", search.author.as_deref());
    }

    match rev {
        Some(rev) => {
            // Evita que una ref que empiece por "-" se interprete como opción.
            args.push("--end-of-options".into());
            args.push(rev.into());
        }
        None => args.push("--all".into()),
    }

    if let Some(path) = search
        .and_then(|filter| filter.path.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        args.push("--".into());
        args.push(path.into());
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
