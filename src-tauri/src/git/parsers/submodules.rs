use crate::git::error::GitError;
use crate::git::models::{Submodule, SubmoduleState};

use super::text;

/// Parses `git submodule status` (one line per submodule, no recursion).
///
/// Format: `[ +-U]<sha> <path>[ (describe)]`. The path can contain spaces,
/// so `describe` is looked up as the last ` (` and only if the line ends
/// in `)`.
pub fn parse_submodule_status(data: &[u8]) -> Result<Vec<Submodule>, GitError> {
    let mut submodules = Vec::new();
    for line in text(data).lines() {
        if line.is_empty() {
            continue;
        }
        let state_char = line.chars().next().unwrap_or(' ');
        let rest = &line[state_char.len_utf8()..];
        let bytes = rest.as_bytes();
        if bytes.len() < 41 || bytes[40] != b' ' || !bytes[..40].iter().all(u8::is_ascii_hexdigit) {
            return Err(GitError::invalid(format!(
                "unreadable submodule line: {line:?}"
            )));
        }
        let remainder = &rest[41..];
        let (path, describe) = match remainder.rfind(" (") {
            Some(index) if remainder.ends_with(')') => (
                remainder[..index].to_string(),
                Some(remainder[index + 2..remainder.len() - 1].to_string()),
            ),
            _ => (remainder.to_string(), None),
        };
        if path.is_empty() {
            return Err(GitError::invalid(format!(
                "submodule line without path: {line:?}"
            )));
        }
        let state = match state_char {
            ' ' => SubmoduleState::Clean,
            '+' => SubmoduleState::Modified,
            '-' => SubmoduleState::Uninitialized,
            'U' => SubmoduleState::Conflict,
            other => {
                return Err(GitError::invalid(format!(
                    "unknown submodule state: {other:?}"
                )));
            }
        };
        submodules.push(Submodule {
            path,
            head: rest[..40].to_string(),
            state,
            describe,
        });
    }
    Ok(submodules)
}
