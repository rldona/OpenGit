use crate::git::error::GitError;
use crate::git::models::Worktree;

use super::text;

/// Parsea `git worktree list --porcelain`.
///
/// Bloques separados por línea vacía; claves: `worktree`, `HEAD`, `branch`,
/// `detached`, `bare`, `locked` (con motivo opcional). `prunable` y extensiones
/// futuras se ignoran.
pub fn parse_worktree_list(data: &[u8]) -> Result<Vec<Worktree>, GitError> {
    let mut worktrees = Vec::new();
    let mut current: Option<Worktree> = None;

    fn flush(current: &mut Option<Worktree>, worktrees: &mut Vec<Worktree>) {
        if let Some(worktree) = current.take() {
            worktrees.push(worktree);
        }
    }

    for line in text(data).lines() {
        if line.is_empty() {
            flush(&mut current, &mut worktrees);
            continue;
        }
        if let Some(path) = line.strip_prefix("worktree ") {
            flush(&mut current, &mut worktrees);
            current = Some(Worktree {
                path: path.to_string(),
                head: String::new(),
                branch: None,
                detached: false,
                bare: false,
                locked: false,
            });
            continue;
        }
        let Some(worktree) = current.as_mut() else {
            return Err(GitError::invalid(format!(
                "worktree line outside a block: {line:?}"
            )));
        };
        if let Some(head) = line.strip_prefix("HEAD ") {
            worktree.head = head.to_string();
        } else if let Some(branch) = line.strip_prefix("branch ") {
            worktree.branch = Some(branch.to_string());
        } else if line == "detached" {
            worktree.detached = true;
        } else if line == "bare" {
            worktree.bare = true;
        } else if line == "locked" || line.starts_with("locked ") {
            worktree.locked = true;
        }
    }
    flush(&mut current, &mut worktrees);
    Ok(worktrees)
}
