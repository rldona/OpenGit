#![allow(dead_code)]
//! Utilidades compartidas por los tests de integración: repos temporales con
//! git real, creados y destruidos por cada test (regla 8 de AGENTS.md).

use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// Dos tests en paralelo no deben compartir carpeta aunque el reloj devuelva
/// el mismo instante: el contador garantiza unicidad dentro del proceso.
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

/// Repo git temporal con identidad y fechas fijas.
pub struct TestRepo {
    dir: TempDir,
}

impl TestRepo {
    /// Envuelve un repo ya existente (por ejemplo, un clon local).
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
            "git {args:?} falló: {}",
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
