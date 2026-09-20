mod log;
mod numstat;
mod refs;
mod stash;
mod status;
mod submodules;
mod worktrees;

pub use log::parse_log;
pub use numstat::parse_numstat;
pub use refs::parse_refs;
pub use stash::parse_stash_list;
pub use status::parse_status;
pub use submodules::parse_submodule_status;
pub use worktrees::parse_worktree_list;

/// Divide por `sep` descartando el registro vacío final (terminador).
pub(crate) fn split_records(data: &[u8], sep: u8) -> Vec<&[u8]> {
    let mut records: Vec<&[u8]> = data.split(|byte| *byte == sep).collect();
    if records.last().is_some_and(|last| last.is_empty()) {
        records.pop();
    }
    records
}

/// Divide por `sep` conservando campos vacíos (incluido el último).
pub(crate) fn split_fields(data: &[u8], sep: u8) -> Vec<&[u8]> {
    data.split(|byte| *byte == sep).collect()
}

/// Divide como `str::splitn`: la última pieza conserva el resto.
pub(crate) fn splitn(data: &[u8], sep: u8, n: usize) -> Vec<&[u8]> {
    let mut pieces = Vec::new();
    let mut start = 0;
    for (index, byte) in data.iter().enumerate() {
        if pieces.len() == n - 1 {
            break;
        }
        if *byte == sep {
            pieces.push(&data[start..index]);
            start = index + 1;
        }
    }
    pieces.push(&data[start..]);
    pieces
}

pub(crate) fn text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}
