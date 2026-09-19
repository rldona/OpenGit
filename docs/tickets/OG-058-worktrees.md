# OG-058 · Manageable worktrees

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** ready
- **Depends on:** OG-024
- **References:** ROADMAP.md, OG-024

## Context

The sidebar lists worktrees and allows opening them, but not creating or
deleting: today it is an informational list. Worktrees are the cheap
alternative to cloning in order to work on two branches at once, and managing
them requires the terminal.

## Scope

- Rust commands: `worktree_add` (path + new or existing branch) and
  `worktree_remove` (with confirmation; `--force` only after an explicit
  warning that there are uncommitted changes).
- UI: mark the current worktree in the list, "New worktree…" and "Remove"
  actions in the context menu of the section and of each entry.
- Opening a worktree keeps working as today (it opens the child repo).

## Acceptance criteria

- [ ] Creating a worktree with a new branch lists it marked as not current and
      it can be opened.
- [ ] Creating a worktree on an existing branch fails with a clear message if
      it is already in use by another worktree.
- [ ] Remove asks for confirmation; if there are uncommitted changes it warns
      and only forces after accepting.
- [ ] The main worktree cannot be deleted (git prevents it; clear message).
- [ ] Integration tests on a temporary repo.

## Out of scope

- Moving existing worktrees.
- `worktree lock/unlock` and `prune`.
- Opening two worktrees in tabs (multi-repo is out of the milestone).

## Technical notes

- `git worktree remove` without `--force` already fails if there are changes:
  use that failure as a signal, just like the force-delete of branches
  (OG-008).
- The worktree list lives in `useExtrasStore`; refresh it after each operation
  and when ref events arrive.
