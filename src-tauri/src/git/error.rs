use std::fmt;

use serde::Serialize;

/// Git adapter error. Serializable so it can reach the UI with context.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum GitError {
    /// The git binary was not found.
    NotFound { binary: String },
    /// The process could not be spawned or its output could not be read.
    Spawn { message: String },
    /// Git exited with a non-zero code.
    CommandFailed {
        exit_code: i32,
        /// Standard output (hooks write their messages here).
        stdout: String,
        stderr: String,
        args: Vec<String>,
    },
    /// The command exceeded its timeout and was terminated.
    Timeout { timeout_ms: u64, args: Vec<String> },
    /// The command was cancelled by the user.
    Cancelled { args: Vec<String> },
    /// Git output does not have the expected format.
    InvalidOutput { message: String },
    /// The given path does not exist or is not a directory.
    PathNotFound { path: String },
    /// The folder is not a git repository.
    NotARepository { path: String },
    /// It is a bare repository: there is no working tree to open.
    NotAWorkTree { path: String },
    /// HEAD does not point to any valid branch or commit.
    InvalidHead { path: String },
    /// The installed git version is older than the supported minimum.
    GitTooOld { found: String, minimum: String },
    /// The persisted app state could not be read or written.
    Store { message: String },
    /// Filesystem error outside the scope of git.
    Io { message: String },
}

impl GitError {
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::InvalidOutput {
            message: message.into(),
        }
    }
}

impl fmt::Display for GitError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound { binary } => {
                write!(f, "git binary not found: {binary}")
            }
            Self::Spawn { message } => write!(f, "could not run git: {message}"),
            Self::CommandFailed {
                exit_code,
                stdout,
                stderr,
                ..
            } => {
                let detail = [stdout.trim(), stderr.trim()]
                    .into_iter()
                    .filter(|part| !part.is_empty())
                    .collect::<Vec<_>>()
                    .join("\n");
                if detail.is_empty() {
                    write!(f, "git failed with code {exit_code}")
                } else {
                    write!(f, "git failed with code {exit_code}: {detail}")
                }
            }
            Self::Timeout { timeout_ms, .. } => {
                write!(f, "git did not finish within {timeout_ms} ms")
            }
            Self::Cancelled { .. } => write!(f, "operation cancelled"),
            Self::InvalidOutput { message } => {
                write!(f, "unexpected git output: {message}")
            }
            Self::PathNotFound { path } => write!(f, "folder does not exist: {path}"),
            Self::NotARepository { path } => {
                write!(f, "not a git repository: {path}")
            }
            Self::NotAWorkTree { path } => {
                write!(f, "bare repositories are not supported: {path}")
            }
            Self::InvalidHead { path } => {
                write!(f, "invalid HEAD: {path}")
            }
            Self::GitTooOld { found, minimum } => {
                write!(f, "git {minimum} or newer is required (found {found})")
            }
            Self::Store { message } => {
                write!(f, "could not save app state: {message}")
            }
            Self::Io { message } => write!(f, "file error: {message}"),
        }
    }
}

impl std::error::Error for GitError {}
