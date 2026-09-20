//! Trabajos de red (fetch/pull/push) con salida en streaming y cancelación.
//!
//! El progreso de git es best-effort: la verdad es el exit code. Las
//! credenciales las resuelve el helper del sistema; nunca se piden en la app.

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
    Pull,
    Push {
        remote: Option<String>,
        set_upstream: bool,
    },
}

impl JobKind {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Fetch { .. } => "fetch",
            Self::Pull => "pull",
            Self::Push { .. } => "push",
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

/// Registro de trabajos en marcha, para poder cancelarlos por id.
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

    /// Marca el job para cancelar; el proceso lo detecta en menos de 100 ms.
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

/// Construye el comando de git del job (sin ejecutarlo).
pub fn command_for(runner: &Runner, repo: &Path, kind: &JobKind) -> Result<GitCommand, GitError> {
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
        JobKind::Pull => {
            args.push("pull".into());
            args.push("--ff-only".into());
            args.push("--progress".into());
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
    }
    Ok(GitCommand::new(args)
        .cwd(repo)
        .write()
        .timeout(JOB_TIMEOUT)
        .env("GIT_PROGRESS_DELAY", "0"))
}

/// Arranca el job en un hilo. Devuelve su token de cancelación (ya registrado
/// en el manager con `id`), para que la UI pueda abortarlo.
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
