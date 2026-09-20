//! Network jobs (fetch/pull/push) with streamed output and cancellation.
//!
//! Git progress is best-effort: the truth is the exit code. The
//! system helper resolves credentials; the app never asks for them.

use std::collections::HashMap;
use std::ffi::OsString;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::git::error::GitError;
use crate::git::runner::{GitCommand, StreamKind, StreamSink};
use crate::git::Runner;

const JOB_TIMEOUT: Duration = Duration::from_secs(600);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum JobKind {
    Fetch {
        prune: bool,
        remote: Option<String>,
    },
    Pull {
        remote: Option<String>,
        branch: Option<String>,
        /// `--rebase` instead of a merge.
        rebase: bool,
        /// `--no-ff`: merge commit even when a fast-forward was possible.
        no_ff: bool,
        /// `--no-commit`: leaves the merged changes uncommitted.
        no_commit: bool,
        /// `--log`: includes the subjects of merged commits in the merge commit.
        include_messages: bool,
    },
    Push {
        remote: Option<String>,
        set_upstream: bool,
    },
    PushTag {
        remote: Option<String>,
        tag: String,
    },
    /// Clone into `destination`; the job runs with the destination's parent as
    /// its working directory (OG-085).
    Clone {
        url: String,
        destination: String,
        depth: Option<u32>,
        branch: Option<String>,
        recurse_submodules: bool,
    },
}

impl JobKind {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Fetch { .. } => "fetch",
            Self::Pull { .. } => "pull",
            Self::Push { .. } => "push",
            Self::PushTag { .. } => "push tag",
            Self::Clone { .. } => "clone",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemoteJobEvent {
    Output {
        stream: StreamKind,
        line: String,
    },
    Finished {
        success: bool,
        exit_code: i32,
        cancelled: bool,
    },
}

/// Registry of running jobs, so they can be cancelled by id.
#[derive(Default)]
pub struct JobManager {
    counter: AtomicU64,
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl JobManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn next_id(&self) -> String {
        format!("job-{}", self.counter.fetch_add(1, Ordering::SeqCst))
    }

    fn insert(&self, id: &str, token: Arc<AtomicBool>) {
        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.insert(id.to_string(), token);
        }
    }

    pub fn remove(&self, id: &str) {
        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.remove(id);
        }
    }

    /// Marks the job for cancellation; the process notices in under 100 ms.
    pub fn cancel(&self, id: &str) -> bool {
        if let Ok(jobs) = self.jobs.lock() {
            if let Some(token) = jobs.get(id) {
                token.store(true, Ordering::SeqCst);
                return true;
            }
        }
        false
    }
}

/// Validates the clone destination and returns the working directory to use
/// (its parent). A readable error beats letting git fail halfway.
fn clone_cwd(destination: &str) -> Result<std::path::PathBuf, GitError> {
    if destination.trim().is_empty() {
        return Err(GitError::invalid(
            "choose a destination folder for the clone",
        ));
    }
    let dest = Path::new(destination);
    if dest.exists() {
        if !dest.is_dir() {
            return Err(GitError::invalid(
                "the destination already exists and is not a folder",
            ));
        }
        let mut entries = std::fs::read_dir(dest).map_err(|error| {
            GitError::invalid(format!("could not read the destination folder: {error}"))
        })?;
        if entries.next().is_some() {
            return Err(GitError::invalid("the destination folder is not empty"));
        }
    }
    let parent = dest
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .ok_or_else(|| GitError::invalid("the destination needs a parent folder"))?;
    if !parent.is_dir() {
        return Err(GitError::invalid(
            "the destination's parent folder does not exist",
        ));
    }
    Ok(parent.to_path_buf())
}

/// Builds the git command for the job (without running it).
pub fn command_for(runner: &Runner, repo: &Path, kind: &JobKind) -> Result<GitCommand, GitError> {
    let cwd = match kind {
        JobKind::Clone { destination, .. } => clone_cwd(destination)?,
        _ => repo.to_path_buf(),
    };
    let mut args: Vec<OsString> = Vec::new();
    match kind {
        JobKind::Fetch { prune, remote } => {
            args.push("fetch".into());
            args.push("--progress".into());
            if *prune {
                args.push("--prune".into());
            }
            match remote {
                Some(remote) => args.push(remote.into()),
                None => args.push("--all".into()),
            }
        }
        JobKind::Pull {
            remote,
            branch,
            rebase,
            no_ff,
            no_commit,
            include_messages,
        } => {
            args.push("pull".into());
            args.push("--progress".into());
            if *rebase {
                args.push("--rebase".into());
            } else {
                if *no_ff {
                    args.push("--no-ff".into());
                }
                if *no_commit {
                    args.push("--no-commit".into());
                }
                if *include_messages {
                    args.push("--log".into());
                }
            }
            if let Some(remote) = remote {
                args.push(remote.into());
                if let Some(branch) = branch {
                    args.push(branch.into());
                }
            }
        }
        JobKind::PushTag { remote, tag } => {
            crate::git::validate_ref_name(runner, repo, tag)?;
            args.push("push".into());
            args.push("--progress".into());
            args.push(remote.clone().unwrap_or_else(|| "origin".into()).into());
            args.push(format!("refs/tags/{tag}").into());
        }
        JobKind::Push {
            remote,
            set_upstream,
        } => {
            args.push("push".into());
            args.push("--progress".into());
            if *set_upstream {
                let tracking = crate::git::branch_tracking(runner, repo)?;
                let branch = tracking.current.ok_or_else(|| {
                    GitError::invalid("detached HEAD: there is no branch to push")
                })?;
                args.push("--set-upstream".into());
                args.push(remote.clone().unwrap_or_else(|| "origin".into()).into());
                args.push(branch.into());
            } else if let Some(remote) = remote {
                args.push(remote.into());
            }
        }
        JobKind::Clone {
            url,
            destination,
            depth,
            branch,
            recurse_submodules,
        } => {
            if url.trim().is_empty() {
                return Err(GitError::invalid("the repository URL is required"));
            }
            args.push("clone".into());
            args.push("--progress".into());
            if let Some(depth) = depth {
                args.push("--depth".into());
                args.push(depth.to_string().into());
            }
            if let Some(branch) = branch {
                if !branch.trim().is_empty() {
                    args.push("--branch".into());
                    args.push(branch.into());
                }
            }
            if *recurse_submodules {
                args.push("--recurse-submodules".into());
            }
            args.push("--".into());
            args.push(url.into());
            args.push(destination.into());
        }
    }
    Ok(GitCommand::new(args)
        .cwd(cwd)
        .write()
        .timeout(JOB_TIMEOUT)
        .env("GIT_PROGRESS_DELAY", "0"))
}

/// Starts the job in a thread. Returns its cancellation token (already registered
/// in the manager with `id`), so the UI can abort it.
pub fn start<F>(
    manager: &JobManager,
    id: &str,
    runner: &Runner,
    repo: &Path,
    kind: &JobKind,
    emit: F,
) -> Result<Arc<AtomicBool>, GitError>
where
    F: Fn(RemoteJobEvent) + Send + Sync + 'static,
{
    let command = command_for(runner, repo, kind)?;
    let emit: Arc<dyn Fn(RemoteJobEvent) + Send + Sync> = Arc::new(emit);
    let sink: StreamSink = {
        let emit = Arc::clone(&emit);
        Arc::new(move |stream, line| {
            emit(RemoteJobEvent::Output { stream, line });
        })
    };
    let process = runner.spawn_streaming(&command, sink)?;
    let token = process.cancel_token();
    manager.insert(id, Arc::clone(&token));

    std::thread::spawn(move || {
        let result = process.wait(JOB_TIMEOUT);
        let (success, exit_code, cancelled) = match &result {
            Ok(output) => (output.success(), output.exit_code(), false),
            Err(GitError::Cancelled { .. }) => (false, -1, true),
            Err(_) => (false, -1, false),
        };
        emit(RemoteJobEvent::Finished {
            success,
            exit_code,
            cancelled,
        });
    });

    Ok(token)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::Runner;

    fn pull_args(kind: &JobKind) -> Vec<String> {
        command_for(&Runner::locate(), Path::new("."), kind)
            .expect("comando de pull")
            .args()
    }

    fn pull(rebase: bool, no_ff: bool, no_commit: bool, include_messages: bool) -> JobKind {
        JobKind::Pull {
            remote: Some("origin".into()),
            branch: Some("main".into()),
            rebase,
            no_ff,
            no_commit,
            include_messages,
        }
    }

    #[test]
    fn fetch_mapea_prune_y_remoto() {
        let args = command_for(
            &Runner::locate(),
            Path::new("."),
            &JobKind::Fetch {
                prune: true,
                remote: Some("origin".into()),
            },
        )
        .expect("comando de fetch")
        .args();
        assert_eq!(args, vec!["fetch", "--progress", "--prune", "origin"]);
    }

    #[test]
    fn pull_por_defecto_mergea_sin_ff_only() {
        assert_eq!(
            pull_args(&pull(false, false, false, false)),
            vec!["pull", "--progress", "origin", "main"]
        );
    }

    #[test]
    fn pull_mapea_las_opciones_del_dialogo() {
        assert_eq!(
            pull_args(&pull(false, true, true, true)),
            vec![
                "pull",
                "--progress",
                "--no-ff",
                "--no-commit",
                "--log",
                "origin",
                "main"
            ]
        );
    }

    #[test]
    fn pull_con_rebase_ignora_las_opciones_de_merge() {
        assert_eq!(
            pull_args(&pull(true, true, true, true)),
            vec!["pull", "--progress", "--rebase", "origin", "main"]
        );
    }

    fn clone_kind(url: &str, destination: &str) -> JobKind {
        JobKind::Clone {
            url: url.into(),
            destination: destination.into(),
            depth: Some(1),
            branch: Some("main".into()),
            recurse_submodules: true,
        }
    }

    #[test]
    fn clone_mapea_url_destino_y_opciones() {
        let destination =
            std::env::temp_dir().join(format!("opengit-clone-args-{}", std::process::id()));
        let destination = destination.to_string_lossy().into_owned();
        let args = command_for(
            &Runner::locate(),
            Path::new("."),
            &clone_kind("https://example.com/repo.git", &destination),
        )
        .expect("comando de clone")
        .args();
        assert_eq!(
            args,
            vec![
                "clone",
                "--progress",
                "--depth",
                "1",
                "--branch",
                "main",
                "--recurse-submodules",
                "--",
                "https://example.com/repo.git",
                destination.as_str(),
            ]
        );
    }

    #[test]
    fn clone_rechaza_url_vacia() {
        let destination =
            std::env::temp_dir().join(format!("opengit-clone-empty-url-{}", std::process::id()));
        let error = command_for(
            &Runner::locate(),
            Path::new("."),
            &clone_kind("  ", &destination.to_string_lossy()),
        )
        .expect_err("una URL vacía debe fallar");
        assert!(error.to_string().contains("URL"));
    }

    #[test]
    fn clone_rechaza_destino_no_vacio() {
        let dir =
            std::env::temp_dir().join(format!("opengit-clone-nonempty-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("crear destino");
        std::fs::write(dir.join("file.txt"), b"x").expect("escribir fichero");
        let error = command_for(
            &Runner::locate(),
            Path::new("."),
            &clone_kind("https://example.com/repo.git", &dir.to_string_lossy()),
        )
        .expect_err("un destino no vacío debe fallar");
        let _ = std::fs::remove_dir_all(&dir);
        assert!(error.to_string().contains("not empty"));
    }
}
