use serde::Serialize;

/// History commit, enough for the graph view.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Commit {
    pub hash: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    /// UNIX timestamp of the author.
    pub author_time: i64,
    /// Refs decorated by `%D` (HEAD, branches, tags, remotes).
    pub refs: Vec<String>,
    pub subject: String,
    /// Message body (`%b`), without the subject. Empty if the commit has none.
    pub body: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StatusKind {
    Ordinary,
    Renamed,
    Unmerged,
    Untracked,
    Ignored,
}

/// Entry of `git status --porcelain=v2`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FileStatus {
    pub kind: StatusKind,
    /// Index/working tree status (XY).
    pub xy: String,
    pub path: String,
    /// Original path in renames and copies.
    pub orig_path: Option<String>,
}

/// Working tree status report, with the branch header.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct StatusReport {
    /// HEAD OID; `None` in a repo without commits.
    pub head: Option<String>,
    /// Current branch; `None` if HEAD is detached.
    pub branch: Option<String>,
    pub detached: bool,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub entries: Vec<FileStatus>,
}

/// Reference from `git for-each-ref`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Ref {
    /// Full name (`refs/heads/main`).
    pub name: String,
    pub object_id: String,
    pub object_type: String,
    pub upstream: Option<String>,
    pub track: Option<String>,
    /// Object the ref resolves to: for an annotated tag, the peeled commit.
    pub target: String,
}

/// Entry of `git stash list`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Stash {
    /// `stash@{n}`.
    pub reference: String,
    pub subject: String,
    pub timestamp: i64,
    pub hash: String,
}

/// File change according to `git diff --numstat`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FileDiff {
    pub path: String,
    /// Original path in renames.
    pub orig_path: Option<String>,
    pub binary: bool,
    pub added: Option<u64>,
    pub deleted: Option<u64>,
}

/// Submodule state relative to the superproject index.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SubmoduleState {
    /// ` `: up to date with the recorded commit.
    Clean,
    /// `+`: the submodule is at a commit different from the recorded one.
    Modified,
    /// `-`: not initialized.
    Uninitialized,
    /// `U`: merge conflict.
    Conflict,
}

/// Entry of `git submodule status`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Submodule {
    pub path: String,
    /// Commit recorded in the superproject index.
    pub head: String,
    pub state: SubmoduleState,
    /// Git description (`heads/main`, a tag, ...), if it provides one.
    pub describe: Option<String>,
}

/// Entry of `git worktree list --porcelain`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Worktree {
    pub path: String,
    pub head: String,
    /// Full ref (`refs/heads/main`); `None` if detached.
    pub branch: Option<String>,
    pub detached: bool,
    pub bare: bool,
    pub locked: bool,
}

/// A Git hook in the repository's hooks directory (OG-098).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Hook {
    /// Hook name (e.g. `pre-commit`), without `.sample`/`.disabled`.
    pub name: String,
    /// Absolute path of the hook file that exists, if any.
    pub path: String,
    /// A real hook file exists (`<name>` or `<name>.disabled`).
    pub installed: bool,
    /// Git would run it (installed and executable on Unix).
    pub active: bool,
    /// A `<name>.sample` is available.
    pub sample: bool,
    /// The hook is disabled by the `.disabled` rename.
    pub disabled: bool,
}

/// Git LFS status in the repository.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LfsStatus {
    /// `git lfs version` works.
    pub installed: bool,
    /// Output of `git lfs version`, if installed.
    pub version: Option<String>,
    /// Some tracked `.gitattributes` uses `filter=lfs`.
    pub configured: bool,
    /// Active `filter=lfs` patterns, prefixed with their `.gitattributes`
    /// directory (OG-097).
    pub patterns: Vec<String>,
}

/// Repository remote, with its web URL when it can be opened.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Remote {
    pub name: String,
    pub url: String,
    /// `https://…` equivalent; `None` for local paths or `file://`.
    pub web_url: Option<String>,
}

/// Effective identity git would use to sign a commit (`git var GIT_AUTHOR_IDENT`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AuthorIdent {
    pub name: String,
    pub email: String,
}

/// Commits still to arrive from the upstream and still to be pushed to it.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct TrackingCommits {
    /// `HEAD..upstream`, in `rev-list` order.
    pub incoming: Vec<String>,
    /// `upstream..HEAD`.
    pub outgoing: Vec<String>,
}

/// One line of `git blame --line-porcelain` (OG-055).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BlameLine {
    /// Line number in the current file.
    pub line: u32,
    /// Commit that last touched the line; all zeros if not committed yet.
    pub hash: String,
    pub author_name: String,
    pub author_email: String,
    pub author_time: i64,
    pub content: String,
}
