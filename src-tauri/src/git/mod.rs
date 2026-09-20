//! Git adapter: safe execution of the system binary (ADR-0003),
//! robust parsing of its output and typed models for the UI.

pub mod error;
pub mod models;
pub mod parsers;
pub mod patch;
pub mod runner;
pub mod version;

pub use error::GitError;
pub use models::{
    AuthorIdent, Commit, FileDiff, FileStatus, LfsStatus, Ref, Remote, Stash, StatusKind,
    StatusReport, Submodule, SubmoduleState, TrackingCommits, Worktree,
};
pub use parsers::{
    parse_gitattributes_paths, parse_gitattributes_uses_lfs, parse_log, parse_numstat, parse_refs,
    parse_stash_list, parse_status, parse_submodule_status, parse_worktree_list,
};
pub use runner::{GitCommand, GitOutput, GitProcess, Runner, StdinMode, DEFAULT_TIMEOUT};
pub use version::{GitVersion, MINIMUM_GIT_VERSION};

use std::ffi::OsString;
use std::path::Path;
use std::time::Duration;

use serde::{Deserialize, Serialize};

/// Format of a log line: fields separated by `%x1f`, commits by `-z`.
pub const LOG_FORMAT: &str = "%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%D%x1f%s%x1f%b";
/// `for-each-ref` format: fields separated by NUL.
pub const REFS_FORMAT: &str =
    "%(refname)%00%(objectname)%00%(objecttype)%00%(upstream)%00%(upstream:track)%00%(*objectname)";

/// Commit of the interactive rebase plan.
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
    /// Action written to git's todo-list.
    fn as_git(self) -> &'static str {
        match self {
            // Reword is resolved with `exec git commit --amend -F` after the pick.
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
    /// New message for `reword`; ignored for the rest of the actions.
    #[serde(default)]
    pub message: Option<String>,
}

/// Commits of `base..HEAD` in chronological order (the one rewritten first).
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

/// Runs the interactive rebase injecting the todo-list with `GIT_SEQUENCE_EDITOR`.
/// Message files live in the app data directory, never in the repo.
pub fn interactive_rebase(
    runner: &Runner,
    repo: &Path,
    data_dir: &Path,
    base: &str,
    todos: &[TodoItem],
) -> Result<(), GitError> {
    validate_commit_hash(base)?;
    if todos.is_empty() {
        return Err(GitError::invalid("rebase plan is empty"));
    }
    for item in todos {
        validate_commit_hash(&item.hash)?;
        if item.action == TodoAction::Reword
            && item
                .message
                .as_deref()
                .map(str::trim)
                .unwrap_or("")
                .is_empty()
        {
            return Err(GitError::invalid("reword needs a message"));
        }
    }

    std::fs::create_dir_all(data_dir).map_err(|error| GitError::Io {
        message: error.to_string(),
    })?;

    let mut todo = String::new();
    for (index, item) in todos.iter().enumerate() {
        todo.push_str(item.action.as_git());
        todo.push(' ');
        todo.push_str(&item.hash);
        todo.push('\n');
        if item.action == TodoAction::Reword {
            let message_file = data_dir.join(format!("rebase-message-{index}.txt"));
            std::fs::write(&message_file, item.message.as_deref().unwrap_or("").trim()).map_err(
                |error| GitError::Io {
                    message: error.to_string(),
                },
            )?;
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

/// Applies the given commit onto the current branch.
pub fn cherry_pick(runner: &Runner, repo: &Path, hash: &str) -> Result<(), GitError> {
    validate_commit_hash(hash)?;
    runner
        .run_checked(&GitCommand::new(["cherry-pick", hash]).cwd(repo).write())
        .map(|_| ())
}

/// Result of a merge. A conflict is not a git error: it leaves the
/// operation half-done and the OG-019/OG-020 flow takes over.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MergeResult {
    pub conflicted: bool,
    /// Combined git output, for the Output panel.
    pub output: String,
}

/// Merge options, mirroring the merge window checkboxes.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeOptions {
    /// `--no-ff`: merge commit even when a fast-forward was possible.
    pub no_ff: bool,
    /// `--no-commit`: stop before committing the merge.
    pub no_commit: bool,
    /// `--log`: include the merged commits' subjects in the merge commit.
    pub include_messages: bool,
    /// `--rebase` instead of a merge.
    pub rebase: bool,
}

fn merge_args(rev: &str, options: MergeOptions) -> Vec<OsString> {
    // `git merge` has no `--rebase`: the checkbox is a rebase of the current
    // branch onto the picked rev, which is what SourceTree runs here.
    if options.rebase {
        return vec!["rebase".into(), "--end-of-options".into(), rev.into()];
    }
    let mut args: Vec<OsString> = vec!["merge".into(), "--no-edit".into()];
    if options.no_ff {
        args.push("--no-ff".into());
    }
    if options.no_commit {
        args.push("--no-commit".into());
    }
    if options.include_messages {
        args.push("--log".into());
    }
    args.push("--end-of-options".into());
    args.push(rev.into());
    args
}

/// Whether the index has unmerged entries, which is what defines a conflict:
/// `MERGE_HEAD` also exists after a clean `--no-commit` merge.
fn has_unmerged(runner: &Runner, repo: &Path) -> Result<bool, GitError> {
    let output = runner.run(&GitCommand::new(["ls-files", "--unmerged"]).cwd(repo))?;
    Ok(!output.stdout_lossy().trim().is_empty())
}

/// `git merge --no-edit [flags] <rev>` onto the current branch.
pub fn merge_branch(
    runner: &Runner,
    repo: &Path,
    rev: &str,
    options: MergeOptions,
) -> Result<MergeResult, GitError> {
    validate_ref_name(runner, repo, rev)?;
    let args = merge_args(rev, options);
    let output = runner.run(&GitCommand::new(args.clone()).cwd(repo).write())?;
    // The exit code does not distinguish conflict from error: unmerged entries do.
    let conflicted = has_unmerged(runner, repo)?;
    if !output.success() && !conflicted {
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
    let mut text = output.stdout_lossy();
    let stderr = output.stderr_lossy();
    if !stderr.trim().is_empty() {
        text.push_str(&stderr);
    }
    Ok(MergeResult {
        conflicted,
        output: text,
    })
}

/// Creates the revert commit of the given commit (default message).
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

/// MIME type of an image, sniffing magic bytes and falling back to extension.
pub fn image_mime(file: &str, bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some("image/png");
    }
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some("image/jpeg");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("image/gif");
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    if bytes.starts_with(b"BM") {
        return Some("image/bmp");
    }
    if bytes.starts_with(&[0x00, 0x00, 0x01, 0x00]) {
        return Some("image/x-icon");
    }
    if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" {
        match &bytes[8..12] {
            b"avif" | b"avis" => return Some("image/avif"),
            b"heic" | b"heix" | b"heif" | b"mif1" => return Some("image/heic"),
            _ => {}
        }
    }
    let lower = file.to_lowercase();
    for (extension, mime) in [
        (".png", "image/png"),
        (".jpg", "image/jpeg"),
        (".jpeg", "image/jpeg"),
        (".gif", "image/gif"),
        (".webp", "image/webp"),
        (".bmp", "image/bmp"),
        (".ico", "image/x-icon"),
        (".avif", "image/avif"),
        (".heic", "image/heic"),
        (".tif", "image/tiff"),
        (".tiff", "image/tiff"),
    ] {
        if lower.ends_with(extension) {
            return Some(mime);
        }
    }
    None
}

/// MIME types of the two sides of an image change; `None` when a side does
/// not exist (added, deleted or unmerged file).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ImagePair {
    pub before: Option<String>,
    pub after: Option<String>,
}

fn show_blob(runner: &Runner, repo: &Path, spec: &str) -> Option<Vec<u8>> {
    let output = runner
        .run(&GitCommand::new(["show", spec]).cwd(repo))
        .ok()?;
    if output.success() {
        Some(output.stdout)
    } else {
        None
    }
}

/// Blobs of both sides: commit (`rev` vs `rev^`), index (`HEAD` vs staged) or
/// working tree (index vs file on disk).
fn image_sides(
    runner: &Runner,
    repo: &Path,
    file: &str,
    rev: Option<&str>,
    staged: bool,
) -> (Option<Vec<u8>>, Option<Vec<u8>>) {
    match rev {
        Some(rev) => (
            show_blob(runner, repo, &format!("{rev}^:{file}")),
            show_blob(runner, repo, &format!("{rev}:{file}")),
        ),
        None if staged => (
            show_blob(runner, repo, &format!("HEAD:{file}")),
            show_blob(runner, repo, &format!(":{file}")),
        ),
        None => {
            let before = show_blob(runner, repo, &format!(":{file}"));
            let after = repo.join(file);
            (before, std::fs::read(after).ok())
        }
    }
}

fn image_side_mime(file: &str, bytes: Option<Vec<u8>>) -> Option<String> {
    bytes.and_then(|bytes| image_mime(file, &bytes).map(str::to_string))
}

/// Which sides of an image change exist, with their MIME types.
pub fn image_pair(
    runner: &Runner,
    repo: &Path,
    file: &str,
    rev: Option<&str>,
    staged: bool,
) -> Result<ImagePair, GitError> {
    crate::repo::ops::relative_path(file)?;
    let (before, after) = image_sides(runner, repo, file, rev, staged);
    Ok(ImagePair {
        before: image_side_mime(file, before),
        after: image_side_mime(file, after),
    })
}

/// Raw bytes of one side of an image change.
pub fn image_bytes(
    runner: &Runner,
    repo: &Path,
    file: &str,
    rev: Option<&str>,
    staged: bool,
    side: &str,
) -> Result<Vec<u8>, GitError> {
    crate::repo::ops::relative_path(file)?;
    let (before, after) = image_sides(runner, repo, file, rev, staged);
    let chosen = if side == "before" { before } else { after };
    chosen.ok_or_else(|| GitError::invalid("image side not found"))
}

/// Mixed reset: moves HEAD and unstages, without touching the working tree.
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

/// Creates a lightweight tag (no message) or annotated tag (with message) at `target`.
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

/// Lists stashes with their reference, message, date and commit.
pub fn stash_list(runner: &Runner, repo: &Path) -> Result<Vec<Stash>, GitError> {
    let output = runner.run_checked(
        &GitCommand::new(["stash", "list", "-z", "--format=%gd%x1f%gs%x1f%ct%x1f%H"]).cwd(repo),
    )?;
    parse_stash_list(&output.stdout)
}

/// Lists the repo submodules (no recursion).
pub fn submodule_status(runner: &Runner, repo: &Path) -> Result<Vec<Submodule>, GitError> {
    let output = runner.run_checked(&GitCommand::new(["submodule", "status"]).cwd(repo))?;
    parse_submodule_status(&output.stdout)
}

/// Lists the repo worktrees, including the main one.
pub fn worktree_list(runner: &Runner, repo: &Path) -> Result<Vec<Worktree>, GitError> {
    let output =
        runner.run_checked(&GitCommand::new(["worktree", "list", "--porcelain"]).cwd(repo))?;
    parse_worktree_list(&output.stdout)
}

/// Git LFS status: binary available and tracked `filter=lfs` attributes.
pub fn lfs_status(runner: &Runner, repo: &Path) -> Result<LfsStatus, GitError> {
    let output = runner.run(&GitCommand::new(["lfs", "version"]).cwd(repo))?;
    let (installed, version) = if output.success() {
        let version = output.stdout_lossy().trim().to_string();
        (
            true,
            if version.is_empty() {
                None
            } else {
                Some(version)
            },
        )
    } else {
        (false, None)
    };

    let listed = runner.run_checked(&GitCommand::new(["ls-files", "-z"]).cwd(repo))?;
    let mut configured = false;
    for path in parse_gitattributes_paths(&listed.stdout) {
        if std::fs::read(repo.join(&path))
            .is_ok_and(|content| parse_gitattributes_uses_lfs(&content))
        {
            configured = true;
            break;
        }
    }

    Ok(LfsStatus {
        installed,
        version,
        configured,
    })
}

/// Converts a remote URL into its web equivalent (`https://…`).
/// Returns `None` for local paths, `file://` or unknown formats.
pub fn remote_web_url(url: &str) -> Option<String> {
    let trimmed = url.trim().trim_end_matches('/');
    if trimmed.is_empty() || trimmed.starts_with("file://") {
        return None;
    }

    let (host, path) = if let Some(rest) = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
    {
        let (host, path) = rest.split_once('/')?;
        (host.to_string(), path.to_string())
    } else if let Some(rest) = trimmed.strip_prefix("ssh://") {
        let (authority, path) = rest.split_once('/')?;
        let authority = authority.rsplit('@').next().unwrap_or(authority);
        let host = authority.split(':').next().unwrap_or(authority);
        (host.to_string(), path.to_string())
    } else if let Some(rest) = trimmed.strip_prefix("git://") {
        let (host, path) = rest.split_once('/')?;
        (host.to_string(), path.to_string())
    } else if let Some((before, after)) = trimmed.split_once(':') {
        // scp format: `git@host:org/repo.git`. Discards local paths and
        // Windows drives before treating it as a host.
        if before.contains('/') || before.contains('\\') || after.starts_with('\\') {
            return None;
        }
        if before.len() == 1 && before.chars().all(|c| c.is_ascii_alphabetic()) {
            return None;
        }
        let host = before.rsplit('@').next().unwrap_or(before);
        (host.to_string(), after.to_string())
    } else {
        return None;
    };

    let path = path.trim_matches('/').trim_end_matches(".git");
    let path = path.trim_end_matches('/');
    if host.is_empty() || path.is_empty() {
        return None;
    }
    Some(format!("https://{host}/{path}"))
}

/// Lists the repo remotes with their URL and web URL when available.
pub fn remote_urls(runner: &Runner, repo: &Path) -> Result<Vec<Remote>, GitError> {
    let listed = runner.run_checked(&GitCommand::new(["remote"]).cwd(repo))?;
    let mut remotes = Vec::new();
    for name in listed
        .stdout_lossy()
        .lines()
        .map(str::trim)
        .filter(|name| !name.is_empty())
    {
        let output = runner.run_checked(&GitCommand::new(["remote", "get-url", name]).cwd(repo))?;
        let url = output.stdout_lossy().trim().to_string();
        remotes.push(Remote {
            name: name.to_string(),
            web_url: remote_web_url(&url),
            url,
        });
    }
    Ok(remotes)
}

/// Effective identity git would use when committing: `Name <email> timestamp tz`.
pub fn author_ident(runner: &Runner, repo: &Path) -> Result<AuthorIdent, GitError> {
    let output = runner.run_checked(&GitCommand::new(["var", "GIT_AUTHOR_IDENT"]).cwd(repo))?;
    let text = output.stdout_lossy();
    let text = text.trim();
    let open = text.rfind('<');
    let close = text.rfind('>');
    match (open, close) {
        (Some(open), Some(close)) if open > 0 && close > open => Ok(AuthorIdent {
            name: text[..open].trim().to_string(),
            email: text[open + 1..close].to_string(),
        }),
        _ => Err(GitError::invalid("could not parse the git author identity")),
    }
}

fn rev_list(runner: &Runner, repo: &Path, range: &str) -> Result<Vec<String>, GitError> {
    let output = runner.run_checked(
        &GitCommand::new(["rev-list", "--max-count=200", "--end-of-options", range]).cwd(repo),
    )?;
    Ok(output
        .stdout_lossy()
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect())
}

/// Hashes of `HEAD..upstream` (incoming) and `upstream..HEAD` (outgoing).
pub fn tracking_commits(
    runner: &Runner,
    repo: &Path,
    upstream: &str,
) -> Result<TrackingCommits, GitError> {
    let upstream = upstream.trim();
    if upstream.is_empty()
        || upstream.starts_with('-')
        || upstream.contains(char::is_whitespace)
        || upstream.contains("..")
    {
        return Err(GitError::invalid(format!(
            "invalid upstream ref: {upstream}"
        )));
    }
    let incoming = rev_list(runner, repo, &format!("HEAD..{upstream}"))?;
    let outgoing = rev_list(runner, repo, &format!("{upstream}..HEAD"))?;
    Ok(TrackingCommits { incoming, outgoing })
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

/// Applies a stash; with `drop` it uses `pop` (only deletes it if it applies cleanly).
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

/// Full patch of a stash, including untracked files saved with `-u`.
pub fn stash_show(runner: &Runner, repo: &Path, reference: &str) -> Result<String, GitError> {
    validate_stash_reference(reference)?;
    let output = runner.run_checked(
        &GitCommand::new(["stash", "show", "-p", "--include-untracked", reference]).cwd(repo),
    )?;
    Ok(output.stdout_lossy())
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

/// Current branch and its relationship with the upstream.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BranchTracking {
    pub current: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
}

/// Which branch we are on and how many commits ahead/behind the upstream.
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

/// Checkout of a local branch or, with `track`, of a remote one creating the local branch.
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

/// Creates a branch at a starting point (hash or ref).
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

/// `force = false` uses `-d`; `-D` only after explicit confirmation in the UI.
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

/// Result of creating a commit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CommitResult {
    pub hash: String,
    pub subject: String,
}

/// Half-done git operation in the repo (merge, rebase, cherry-pick/revert),
/// with the current step when it is a rebase.
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

/// Message of the last commit, to preload the amend.
pub fn last_commit_message(runner: &Runner, repo: &Path) -> Result<String, GitError> {
    let output = runner.run_checked(&GitCommand::new(["log", "-1", "--format=%B"]).cwd(repo))?;
    Ok(output.stdout_lossy().trim_end().to_string())
}

/// Creates the commit with the message via stdin (never interpolated into `-m`).
/// `--no-verify` is not passed: the user's hooks rule.
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

/// Detects an in-progress merge, rebase or cherry-pick/revert, with the rebase step.
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

/// Cancels the operation in progress (merge, rebase, cherry-pick or revert).
pub fn repo_op_abort(runner: &Runner, repo: &Path) -> Result<(), GitError> {
    let state = repo_op_state(runner, repo)?;
    let operation = state
        .operation()
        .ok_or_else(|| GitError::invalid("no operation in progress"))?;
    runner
        .run_checked(&GitCommand::new([operation, "--abort"]).cwd(repo).write())
        .map(|_| ())
}

/// Continues the operation in progress accepting the default message.
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

/// Skips the conflicted commit or patch of the operation in progress.
pub fn repo_op_skip(runner: &Runner, repo: &Path) -> Result<(), GitError> {
    let state = repo_op_state(runner, repo)?;
    let operation = state
        .operation()
        .ok_or_else(|| GitError::invalid("no operation in progress"))?;
    if operation == "merge" {
        return Err(GitError::invalid(
            "merge has no skip: resolve the conflicts or abort",
        ));
    }
    runner
        .run_checked(
            &GitCommand::new([operation, "--skip"])
                .cwd(repo)
                .write()
                .env("GIT_EDITOR", "true"),
        )
        .map(|_| ())
}

/// History search filters (literal, no regex).
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

/// Page of history in topological order. With `rev = None` it walks all the
/// refs; with `search` it filters by message, author and/or path (literally).
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
            // Prevents a ref starting with "-" from being parsed as an option.
            args.push("--end-of-options".into());
            args.push(rev.into());
        }
        None => {
            // `--all` would include `refs/stash`, and with it the stash commit
            // and its internal commit "index on <branch>: …", which have no
            // place in the history: stashes have their own section.
            // The `--exclude` affects the `--all` right behind it.
            args.push("--exclude=refs/stash".into());
            args.push("--all".into());
        }
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

/// True if HEAD points to a commit (repo with history).
pub fn has_commits(runner: &Runner, repo: &Path) -> Result<bool, GitError> {
    let cmd = GitCommand::new(["rev-parse", "--verify", "--quiet", "HEAD"]).cwd(repo);
    Ok(runner.run(&cmd)?.success())
}

/// Working tree status with the branch header.
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

/// Local branches, remotes and tags.
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

/// Per-file changes with rename detection; `cached` compares the index with HEAD.
pub fn diff_numstat(runner: &Runner, repo: &Path, cached: bool) -> Result<Vec<FileDiff>, GitError> {
    let mut args: Vec<OsString> = vec!["diff".into(), "--numstat".into(), "-z".into(), "-M".into()];
    if cached {
        args.push("--cached".into());
    }
    let output = runner.run_checked(&GitCommand::new(args).cwd(repo))?;
    parse_numstat(&output.stdout)
}

/// Files touched by a commit (numstat with renames).
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

/// Patch of a file from the working tree or the index (`staged`), optionally
/// reversed (`-R`) for the "reverse hunk".
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

/// Patch of a file from the working tree or the index, in bytes.
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

/// Applies a patch to the index via stdin (never via a temporary file).
pub fn apply_index_patch(
    runner: &Runner,
    repo: &Path,
    patch: &[u8],
    reverse: bool,
) -> Result<(), GitError> {
    let mut args: Vec<OsString> = vec![
        "apply".into(),
        "--cached".into(),
        "--unidiff-zero".into(),
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

/// Partial stage/unstage: whole file or a selection of hunks/lines.
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

/// Applies a patch to the working tree via stdin; with `reverse` it discards it.
/// `--unidiff-zero` is necessary because a line selection can leave the hunk
/// edge without context; the patch is rebuilt from the diff just read.
pub fn apply_worktree_patch(
    runner: &Runner,
    repo: &Path,
    patch: &[u8],
    reverse: bool,
) -> Result<(), GitError> {
    let mut args: Vec<OsString> = vec![
        "apply".into(),
        "--unidiff-zero".into(),
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

/// Discards a selection of hunks/lines from the working tree (destructive).
pub fn discard_selection(
    runner: &Runner,
    repo: &Path,
    file: &str,
    selection: &patch::HunkSelection,
) -> Result<(), GitError> {
    if matches!(selection, patch::HunkSelection::File) {
        return Err(GitError::invalid(
            "whole-file discard is not resolved with patches",
        ));
    }
    let data = worktree_diff_bytes(runner, repo, file, false)?;
    let parsed = patch::parse(&data);
    let Some(built) = parsed.build(selection)? else {
        return Ok(());
    };
    apply_worktree_patch(runner, repo, &built, true)
}

/// Patch of a file inside a commit (it also works on the root commit).
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

#[cfg(test)]
mod merge_args_tests {
    use super::*;

    fn args_of(options: MergeOptions) -> Vec<String> {
        merge_args("feature", options)
            .iter()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn merge_without_flags() {
        assert_eq!(
            args_of(MergeOptions::default()),
            vec!["merge", "--no-edit", "--end-of-options", "feature"]
        );
    }

    #[test]
    fn merge_with_the_window_checkboxes() {
        assert_eq!(
            args_of(MergeOptions {
                no_ff: true,
                no_commit: true,
                include_messages: true,
                rebase: false,
            }),
            vec![
                "merge",
                "--no-edit",
                "--no-ff",
                "--no-commit",
                "--log",
                "--end-of-options",
                "feature"
            ]
        );
    }

    #[test]
    fn rebase_ignores_the_merge_only_flags() {
        assert_eq!(
            args_of(MergeOptions {
                no_ff: true,
                no_commit: true,
                include_messages: true,
                rebase: true,
            }),
            vec!["rebase", "--end-of-options", "feature"]
        );
    }
}
