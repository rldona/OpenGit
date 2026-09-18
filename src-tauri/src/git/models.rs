use serde::Serialize;

/// Commit del historial, suficiente para la vista de grafo.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Commit {
    pub hash: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    /// Timestamp UNIX del autor.
    pub author_time: i64,
    /// Refs decoradas por `%D` (HEAD, ramas, tags, remotos).
    pub refs: Vec<String>,
    pub subject: String,
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

/// Entrada de `git status --porcelain=v2`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FileStatus {
    pub kind: StatusKind,
    /// Estado índice/working tree (XY).
    pub xy: String,
    pub path: String,
    /// Ruta original en renombrados y copias.
    pub orig_path: Option<String>,
}

/// Informe de estado del working tree, con la cabecera de rama.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct StatusReport {
    /// OID de HEAD; `None` en un repo sin commits.
    pub head: Option<String>,
    /// Rama actual; `None` si HEAD está detached.
    pub branch: Option<String>,
    pub detached: bool,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub entries: Vec<FileStatus>,
}

/// Referencia de `git for-each-ref`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Ref {
    /// Nombre completo (`refs/heads/main`).
    pub name: String,
    pub object_id: String,
    pub object_type: String,
    pub upstream: Option<String>,
    pub track: Option<String>,
}

/// Entrada de `git stash list`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Stash {
    /// `stash@{n}`.
    pub reference: String,
    pub subject: String,
    pub timestamp: i64,
    pub hash: String,
}

/// Cambio de fichero según `git diff --numstat`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FileDiff {
    pub path: String,
    /// Ruta original en renombrados.
    pub orig_path: Option<String>,
    pub binary: bool,
    pub added: Option<u64>,
    pub deleted: Option<u64>,
}

/// Estado del submódulo respecto al índice del superproyecto.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SubmoduleState {
    /// ` `: al día con el commit registrado.
    Clean,
    /// `+`: el submódulo está en un commit distinto del registrado.
    Modified,
    /// `-`: no inicializado.
    Uninitialized,
    /// `U`: conflicto de merge.
    Conflict,
}

/// Entrada de `git submodule status`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Submodule {
    pub path: String,
    /// Commit registrado en el índice del superproyecto.
    pub head: String,
    pub state: SubmoduleState,
    /// Descripción de git (`heads/main`, un tag, ...), si la da.
    pub describe: Option<String>,
}

/// Entrada de `git worktree list --porcelain`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Worktree {
    pub path: String,
    pub head: String,
    /// Ref completa (`refs/heads/main`); `None` si está detached.
    pub branch: Option<String>,
    pub detached: bool,
    pub bare: bool,
    pub locked: bool,
}

/// Estado de Git LFS en el repositorio.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LfsStatus {
    /// `git lfs version` funciona.
    pub installed: bool,
    /// Salida de `git lfs version`, si está instalado.
    pub version: Option<String>,
    /// Algún `.gitattributes` rastreado usa `filter=lfs`.
    pub configured: bool,
}
