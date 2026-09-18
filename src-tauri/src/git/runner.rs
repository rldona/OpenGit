use std::ffi::OsString;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{ChildStdin, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;
#[cfg(unix)]
use std::time::Instant;

use super::error::GitError;
use super::version::GitVersion;

pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);
const KILL_GRACE: Duration = Duration::from_millis(500);

/// Cómo se conecta stdin del proceso.
#[derive(Debug, Clone, Default)]
pub enum StdinMode {
    /// Cerrado: los comandos que lean de stdin reciben EOF.
    #[default]
    Null,
    /// Se escriben los bytes y se cierra.
    Bytes(Vec<u8>),
    /// Se mantiene abierto mientras viva el proceso. Solo para tests que
    /// necesitan un comando bloqueado que poder cancelar.
    Open,
}

/// Una invocación de git: argumentos separados, cwd y entorno controlado.
#[derive(Debug, Clone)]
pub struct GitCommand {
    args: Vec<OsString>,
    cwd: Option<PathBuf>,
    env: Vec<(OsString, OsString)>,
    stdin: StdinMode,
    timeout: Duration,
    write: bool,
}

impl GitCommand {
    pub fn new<I, S>(args: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<OsString>,
    {
        Self {
            args: args.into_iter().map(Into::into).collect(),
            cwd: None,
            env: Vec::new(),
            stdin: StdinMode::Null,
            timeout: DEFAULT_TIMEOUT,
            write: false,
        }
    }

    pub fn cwd(mut self, path: impl Into<PathBuf>) -> Self {
        self.cwd = Some(path.into());
        self
    }

    pub fn env(mut self, key: impl Into<OsString>, value: impl Into<OsString>) -> Self {
        self.env.push((key.into(), value.into()));
        self
    }

    pub fn stdin_bytes(mut self, bytes: Vec<u8>) -> Self {
        self.stdin = StdinMode::Bytes(bytes);
        self
    }

    pub fn keep_stdin_open(mut self) -> Self {
        self.stdin = StdinMode::Open;
        self
    }

    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Los comandos que escriben en el repo necesitan locks; las lecturas no.
    pub fn write(mut self) -> Self {
        self.write = true;
        self
    }

    pub fn args(&self) -> Vec<String> {
        self.args
            .iter()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect()
    }

    pub fn timeout_value(&self) -> Duration {
        self.timeout
    }
}

#[derive(Debug)]
pub struct GitOutput {
    pub status: ExitStatus,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

impl GitOutput {
    pub fn success(&self) -> bool {
        self.status.success()
    }

    pub fn exit_code(&self) -> i32 {
        self.status.code().unwrap_or(-1)
    }

    pub fn stdout_lossy(&self) -> String {
        String::from_utf8_lossy(&self.stdout).into_owned()
    }

    pub fn stderr_lossy(&self) -> String {
        String::from_utf8_lossy(&self.stderr).into_owned()
    }
}

/// Ejecuta el binario de git. No conoce repositorios ni parsers.
#[derive(Debug, Clone)]
pub struct Runner {
    binary: PathBuf,
}

impl Runner {
    pub fn new(binary: impl Into<PathBuf>) -> Self {
        Self {
            binary: binary.into(),
        }
    }

    /// Usa `git` del PATH.
    pub fn locate() -> Self {
        Self::new("git")
    }

    pub fn binary(&self) -> &Path {
        &self.binary
    }

    pub fn version(&self) -> Result<GitVersion, GitError> {
        let output = self.run_checked(&GitCommand::new(["--version"]))?;
        GitVersion::parse(&output.stdout_lossy())
    }

    /// Ejecuta y devuelve la salida tal cual, aunque git falle.
    pub fn run(&self, cmd: &GitCommand) -> Result<GitOutput, GitError> {
        self.spawn(cmd)?.wait(cmd.timeout)
    }

    /// Ejecuta y convierte un exit code distinto de cero en `CommandFailed`.
    pub fn run_checked(&self, cmd: &GitCommand) -> Result<GitOutput, GitError> {
        let output = self.run(cmd)?;
        if output.success() {
            Ok(output)
        } else {
            Err(GitError::CommandFailed {
                exit_code: output.exit_code(),
                stderr: output.stderr_lossy(),
                args: cmd.args(),
            })
        }
    }

    /// Lanza el proceso en su propio grupo (Unix) para poder matar el árbol.
    pub fn spawn(&self, cmd: &GitCommand) -> Result<GitProcess, GitError> {
        let mut command = Command::new(&self.binary);
        command
            .args(&cmd.args)
            .stdin(match &cmd.stdin {
                StdinMode::Null => Stdio::null(),
                _ => Stdio::piped(),
            })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C")
            .env("LANG", "C");
        if !cmd.write {
            command.env("GIT_OPTIONAL_LOCKS", "0");
        }
        if let Some(cwd) = &cmd.cwd {
            command.current_dir(cwd);
        }
        for (key, value) in &cmd.env {
            command.env(key, value);
        }
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }

        let mut child = command.spawn().map_err(|err| match err.kind() {
            io::ErrorKind::NotFound => GitError::NotFound {
                binary: self.binary.display().to_string(),
            },
            _ => GitError::Spawn {
                message: err.to_string(),
            },
        })?;
        let pid = child.id();

        let stdin = match &cmd.stdin {
            StdinMode::Null => None,
            StdinMode::Open => child.stdin.take(),
            StdinMode::Bytes(bytes) => {
                if let Some(mut handle) = child.stdin.take() {
                    let bytes = bytes.clone();
                    thread::spawn(move || {
                        let _ = handle.write_all(&bytes);
                    });
                }
                None
            }
        };

        let stdout = child.stdout.take().expect("stdout fue redirigido a pipe");
        let stderr = child.stderr.take().expect("stderr fue redirigido a pipe");
        let stdout_handle = thread::spawn(move || read_all(stdout));
        let stderr_handle = thread::spawn(move || read_all(stderr));

        let exited = Arc::new(AtomicBool::new(false));
        let (tx, rx) = mpsc::channel();
        let wait_handle = {
            let exited = Arc::clone(&exited);
            thread::spawn(move || {
                let status = child.wait();
                exited.store(true, Ordering::SeqCst);
                let _ = tx.send(status);
            })
        };

        Ok(GitProcess {
            pid,
            exited,
            stdout: stdout_handle,
            stderr: stderr_handle,
            wait_rx: rx,
            wait_handle,
            stdin,
            args: cmd.args(),
            cancelled: false,
        })
    }
}

/// Proceso de git en marcha, cancelable y con timeout.
pub struct GitProcess {
    pid: u32,
    exited: Arc<AtomicBool>,
    stdout: JoinHandle<io::Result<Vec<u8>>>,
    stderr: JoinHandle<io::Result<Vec<u8>>>,
    wait_rx: mpsc::Receiver<io::Result<ExitStatus>>,
    wait_handle: JoinHandle<()>,
    stdin: Option<ChildStdin>,
    args: Vec<String>,
    cancelled: bool,
}

impl GitProcess {
    pub fn pid(&self) -> u32 {
        self.pid
    }

    pub fn cancel(&mut self) -> Result<(), GitError> {
        if self.cancelled {
            return Ok(());
        }
        self.cancelled = true;
        if !self.exited.load(Ordering::SeqCst) {
            kill_tree(self.pid);
        }
        Ok(())
    }

    pub fn wait(mut self, timeout: Duration) -> Result<GitOutput, GitError> {
        match self.wait_rx.recv_timeout(timeout) {
            Ok(Ok(status)) => {
                drop(self.stdin.take());
                let stdout = join_reader(self.stdout)?;
                let stderr = join_reader(self.stderr)?;
                let _ = self.wait_handle.join();
                if self.cancelled {
                    return Err(GitError::Cancelled { args: self.args });
                }
                Ok(GitOutput {
                    status,
                    stdout,
                    stderr,
                })
            }
            Ok(Err(err)) => {
                let _ = self.wait_handle.join();
                Err(GitError::Spawn {
                    message: err.to_string(),
                })
            }
            Err(RecvTimeoutError::Timeout) => {
                drop(self.stdin.take());
                kill_tree(self.pid);
                let _ = self.wait_rx.recv_timeout(Duration::from_secs(5));
                let _ = self.wait_handle.join();
                Err(GitError::Timeout {
                    timeout_ms: timeout.as_millis() as u64,
                    args: self.args,
                })
            }
            Err(RecvTimeoutError::Disconnected) => Err(GitError::Spawn {
                message: "el hilo de espera terminó sin estado".into(),
            }),
        }
    }
}

fn read_all(mut reader: impl Read) -> io::Result<Vec<u8>> {
    let mut buffer = Vec::new();
    reader.read_to_end(&mut buffer)?;
    Ok(buffer)
}

fn join_reader(handle: JoinHandle<io::Result<Vec<u8>>>) -> Result<Vec<u8>, GitError> {
    match handle.join() {
        Ok(Ok(bytes)) => Ok(bytes),
        Ok(Err(err)) => Err(GitError::Spawn {
            message: err.to_string(),
        }),
        Err(_) => Err(GitError::Spawn {
            message: "el lector de salida de git murió".into(),
        }),
    }
}

/// Termina el proceso y sus hijos: SIGTERM al grupo y, si no muere,
/// SIGKILL tras un periodo de gracia. En Windows usa `taskkill /T`.
fn kill_tree(pid: u32) {
    #[cfg(unix)]
    unsafe {
        libc::kill(-(pid as i32), libc::SIGTERM);
        libc::kill(pid as i32, libc::SIGTERM);
    }
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(unix)]
    {
        let deadline = Instant::now() + KILL_GRACE;
        while Instant::now() < deadline {
            let alive = unsafe { libc::kill(pid as i32, 0) } == 0;
            if !alive {
                return;
            }
            thread::sleep(Duration::from_millis(25));
        }
        unsafe {
            libc::kill(-(pid as i32), libc::SIGKILL);
            libc::kill(pid as i32, libc::SIGKILL);
        }
    }
}
