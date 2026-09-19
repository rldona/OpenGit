#![allow(dead_code)]
//! Helpers shared by the integration tests: temporary repos with real git,
//! created and destroyed by each test (rule 8 of AGENTS.md).

use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// Two tests in parallel must not share a folder even if the clock returns
/// the same instant: the counter guarantees uniqueness inside the process.
static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

pub struct TempDir {
    path: PathBuf,
}

impl TempDir {
    pub fn new(prefix: &str) -> Self {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("reloj del sistema")
            .as_nanos();
        let unique = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "opengit-{prefix}-{}-{nanos}-{unique}",
            std::process::id()
        ));
        std::fs::create_dir_all(&path).expect("crear tempdir");
        Self { path }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}

/// Temporary git repo with fixed identity and dates.
pub struct TestRepo {
    dir: TempDir,
}

impl TestRepo {
    /// Wraps an existing repo (for example, a local clone).
    pub fn at(path: &Path) -> Self {
        Self {
            dir: TempDir {
                path: path.to_path_buf(),
            },
        }
    }

    pub fn init() -> Self {
        let repo = Self {
            dir: TempDir::new("repo"),
        };
        repo.git_ok(&["init", "-b", "main", "-q"]);
        repo.git_ok(&["config", "user.name", "OpenGit Test"]);
        repo.git_ok(&["config", "user.email", "test@opengit.dev"]);
        repo.git_ok(&["config", "commit.gpgsign", "false"]);
        repo.git_ok(&["config", "core.autocrlf", "false"]);
        repo
    }

    pub fn path(&self) -> &Path {
        self.dir.path()
    }

    pub fn write(&self, relative: &str, bytes: &[u8]) {
        let path = self.path().join(relative);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("crear carpeta del fixture");
        }
        std::fs::write(path, bytes).expect("escribir fichero del fixture");
    }

    pub fn git(&self, args: &[&str]) -> Output {
        git(self.path(), args)
    }

    pub fn git_ok(&self, args: &[&str]) -> Output {
        let output = self.git(args);
        assert!(
            output.status.success(),
            "git {args:?} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        output
    }
}

pub fn git(cwd: &Path, args: &[&str]) -> Output {
    Command::new("git")
        .args(args)
        .current_dir(cwd)
        .env("GIT_AUTHOR_NAME", "OpenGit Test")
        .env("GIT_AUTHOR_EMAIL", "test@opengit.dev")
        .env("GIT_COMMITTER_NAME", "OpenGit Test")
        .env("GIT_COMMITTER_EMAIL", "test@opengit.dev")
        .env("GIT_AUTHOR_DATE", "2026-09-18T10:00:00+00:00")
        .env("GIT_COMMITTER_DATE", "2026-09-18T10:00:00+00:00")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C")
        .env("LANG", "C")
        .output()
        .expect("ejecutar git")
}
