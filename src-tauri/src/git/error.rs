use std::fmt;

use serde::Serialize;

/// Error del adaptador de git. Serializable para llegar a la UI con contexto.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum GitError {
    /// No se encontró el binario de git.
    NotFound { binary: String },
    /// El proceso no se pudo lanzar o su salida no se pudo leer.
    Spawn { message: String },
    /// Git terminó con código distinto de cero.
    CommandFailed {
        exit_code: i32,
        /// Salida estándar (los hooks escriben aquí sus mensajes).
        stdout: String,
        stderr: String,
        args: Vec<String>,
    },
    /// El comando superó su timeout y fue terminado.
    Timeout { timeout_ms: u64, args: Vec<String> },
    /// El comando fue cancelado por el usuario.
    Cancelled { args: Vec<String> },
    /// La salida de git no tiene el formato esperado.
    InvalidOutput { message: String },
    /// La ruta indicada no existe o no es un directorio.
    PathNotFound { path: String },
    /// La carpeta no es un repositorio git.
    NotARepository { path: String },
    /// Es un repositorio bare: no hay working tree que abrir.
    NotAWorkTree { path: String },
    /// HEAD no apunta a ninguna rama ni commit válidos.
    InvalidHead { path: String },
    /// La versión de git instalada es anterior al mínimo soportado.
    GitTooOld { found: String, minimum: String },
    /// No se pudo leer o escribir el estado persistido de la app.
    Store { message: String },
    /// Error de sistema de ficheros fuera del alcance de git.
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
