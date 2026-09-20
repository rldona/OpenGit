use std::ffi::OsString;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{ChildStdin, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use super::error::GitError;
use super::version::GitVersion;

pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

/// Receives each line (or fragment separated by `\r`, typical of progress).
pub type StreamSink = Arc<dyn Fn(StreamKind, String) + Send + Sync>;
const KILL_GRACE: Duration = Duration::from_millis(500);

/// How the process stdin is connected.
#[derive(Debug, Clone, Default)]
pub enum StdinMode {
    /// Closed: commands reading from stdin get EOF.
    #[default]
    Null,
    /// The bytes are written and it is closed.
    Bytes(Vec<u8>),
    /// Kept open while the process lives. Only for tests that need a
    /// blocked command they can cancel.
    Open,
}

/// A git invocation: separate arguments, cwd and controlled environment.
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

    /// Commands that write to the repo need locks; reads do not.
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

/// Runs the git binary. It knows nothing about repositories or parsers.
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

    /// Uses `git` from PATH.
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

    /// Runs and returns the output as-is, even if git fails.
    pub fn run(&self, cmd: &GitCommand) -> Result<GitOutput, GitError> {
        self.spawn(cmd)?.wait(cmd.timeout)
    }

    /// Runs and turns a non-zero exit code into `CommandFailed`.
    pub fn run_checked(&self, cmd: &GitCommand) -> Result<GitOutput, GitError> {
        let output = self.run(cmd)?;
        if output.success() {
            Ok(output)
        } else {
            Err(GitError::CommandFailed {
                exit_code: output.exit_code(),
                stdout: output.stdout_lossy(),
                stderr: output.stderr_lossy(),
                args: cmd.args(),
            })
        }
    }

    /// Spawns the process in its own group (Unix) so the tree can be killed.
    pub fn spawn(&self, cmd: &GitCommand) -> Result<GitProcess, GitError> {
        self.spawn_inner(cmd, None)
    }

    /// Same as `spawn`, but each stdout/stderr line is delivered to the sink
    /// as soon as it arrives (for fetch/pull/push with progress).
    pub fn spawn_streaming(
        &self,
        cmd: &GitCommand,
        sink: StreamSink,
    ) -> Result<GitProcess, GitError> {
        self.spawn_inner(cmd, Some(sink))
    }

    fn spawn_inner(
        &self,
        cmd: &GitCommand,
        sink: Option<StreamSink>,
    ) -> Result<GitProcess, GitError> {
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

        let stdout = child
            .stdout
            .take()
            .expect("stdout was redirected to a pipe");
        let stderr = child
            .stderr
            .take()
            .expect("stderr was redirected to a pipe");
        let stdout_sink = sink.clone();
        let stdout_handle =
            thread::spawn(move || read_stream(stdout, stdout_sink, StreamKind::Stdout));
        let stderr_handle = thread::spawn(move || read_stream(stderr, sink, StreamKind::Stderr));

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
            cancel: Arc::new(AtomicBool::new(false)),
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

/// Process output stream.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamKind {
    Stdout,
    Stderr,
}

impl StreamKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stdout => "stdout",
            Self::Stderr => "stderr",
        }
    }
}

/// Running git process, cancellable and with timeout. Cancellation can
/// arrive from outside through the token (`Arc<AtomicBool>`).
pub struct GitProcess {
    pid: u32,
    exited: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
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

    /// Shareable token to cancel the process from another thread.
    pub fn cancel_token(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.cancel)
    }

    pub fn cancel(&mut self) -> Result<(), GitError> {
        if self.cancelled {
            return Ok(());
        }
        self.cancelled = true;
        self.cancel.store(true, Ordering::SeqCst);
        if !self.exited.load(Ordering::SeqCst) {
            kill_tree(self.pid);
        }
        Ok(())
    }

    pub fn wait(mut self, timeout: Duration) -> Result<GitOutput, GitError> {
        let deadline = Instant::now() + timeout;
        loop {
            if self.cancel.load(Ordering::SeqCst) {
                self.cancelled = true;
            }
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                drop(self.stdin.take());
                kill_tree(self.pid);
                let _ = self.wait_rx.recv_timeout(Duration::from_secs(5));
                let _ = self.wait_handle.join();
                return Err(GitError::Timeout {
                    timeout_ms: timeout.as_millis() as u64,
                    args: self.args,
                });
            }
            match self
                .wait_rx
                .recv_timeout(remaining.min(Duration::from_millis(100)))
            {
                Ok(Ok(status)) => {
                    drop(self.stdin.take());
                    let stdout = join_reader(self.stdout)?;
                    let stderr = join_reader(self.stderr)?;
                    let _ = self.wait_handle.join();
                    if self.cancelled {
                        return Err(GitError::Cancelled { args: self.args });
                    }
                    return Ok(GitOutput {
                        status,
                        stdout,
                        stderr,
                    });
                }
                Ok(Err(err)) => {
                    let _ = self.wait_handle.join();
                    return Err(GitError::Spawn {
                        message: err.to_string(),
                    });
                }
                Err(RecvTimeoutError::Timeout) => {
                    if self.cancel.load(Ordering::SeqCst) {
                        drop(self.stdin.take());
                        kill_tree(self.pid);
                        let _ = self.wait_rx.recv_timeout(Duration::from_secs(5));
                        let _ = self.wait_handle.join();
                        return Err(GitError::Cancelled { args: self.args });
                    }
                }
                Err(RecvTimeoutError::Disconnected) => {
                    return Err(GitError::Spawn {
                        message: "wait thread finished without status".into(),
                    });
                }
            }
        }
    }
}

/// Reads a stream splitting on `\n` or `\r` (git progress uses CR):
/// each fragment goes to the sink and everything is accumulated for the final result.
fn read_stream(
    mut reader: impl Read,
    sink: Option<StreamSink>,
    kind: StreamKind,
) -> io::Result<Vec<u8>> {
    // Without a sink not a single byte is touched: there are CRLF patches that must survive.
    if sink.is_none() {
        let mut collected = Vec::new();
        reader.read_to_end(&mut collected)?;
        return Ok(collected);
    }

    let mut collected = Vec::new();
    let mut segment = Vec::new();
    let mut chunk = [0u8; 4096];
    loop {
        let read = reader.read(&mut chunk)?;
        if read == 0 {
            break;
        }
        for byte in &chunk[..read] {
            if *byte == b'\n' || *byte == b'\r' {
                if !segment.is_empty() {
                    if let Some(sink) = &sink {
                        sink(kind, String::from_utf8_lossy(&segment).into_owned());
                    }
                    collected.extend_from_slice(&segment);
                    collected.push(b'\n');
                    segment.clear();
                }
            } else {
                segment.push(*byte);
            }
        }
    }
    if !segment.is_empty() {
        if let Some(sink) = &sink {
            sink(kind, String::from_utf8_lossy(&segment).into_owned());
        }
        collected.extend_from_slice(&segment);
    }
    Ok(collected)
}

fn join_reader(handle: JoinHandle<io::Result<Vec<u8>>>) -> Result<Vec<u8>, GitError> {
    match handle.join() {
        Ok(Ok(bytes)) => Ok(bytes),
        Ok(Err(err)) => Err(GitError::Spawn {
            message: err.to_string(),
        }),
        Err(_) => Err(GitError::Spawn {
            message: "git output reader panicked".into(),
        }),
    }
}

/// Terminates the process and its children: SIGTERM to the group and, if it
/// does not die, SIGKILL after a grace period. On Windows it uses `taskkill /T`.
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
