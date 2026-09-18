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
                write!(f, "no se encontró el binario de git: {binary}")
            }
            Self::Spawn { message } => write!(f, "no se pudo ejecutar git: {message}"),
            Self::CommandFailed {
                exit_code, stderr, ..
            } => {
                if stderr.trim().is_empty() {
                    write!(f, "git falló con código {exit_code}")
                } else {
                    write!(f, "git falló con código {exit_code}: {}", stderr.trim())
                }
            }
            Self::Timeout { timeout_ms, .. } => {
                write!(f, "git no terminó en {timeout_ms} ms")
            }
            Self::Cancelled { .. } => write!(f, "operación cancelada"),
            Self::InvalidOutput { message } => {
                write!(f, "salida de git inesperada: {message}")
            }
            Self::PathNotFound { path } => write!(f, "la carpeta no existe: {path}"),
            Self::NotARepository { path } => {
                write!(f, "la carpeta no es un repositorio git: {path}")
            }
            Self::NotAWorkTree { path } => {
                write!(f, "los repositorios bare no están soportados: {path}")
            }
            Self::InvalidHead { path } => {
                write!(f, "el repositorio tiene un HEAD inválido: {path}")
            }
            Self::GitTooOld { found, minimum } => {
                write!(
                    f,
                    "se requiere git {minimum} o superior (instalado {found})"
                )
            }
            Self::Store { message } => {
                write!(f, "no se pudo guardar el estado de la app: {message}")
            }
            Self::Io { message } => write!(f, "error de fichero: {message}"),
        }
    }
}

impl std::error::Error for GitError {}
