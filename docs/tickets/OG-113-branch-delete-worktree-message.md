# OG-113 · Friendly error when deleting a branch checked out in a worktree

- **Milestone:** Next
- **Status:** done
- **Depends on:** none
- **References:** `src-tauri/src/git/mod.rs`, sidebar branches section

## Context

Deleting a branch checked out in another worktree fails with
`error: cannot delete branch 'X' used by worktree at '<path>'`. This is git's
expected behaviour, but the raw stderr is shown in the sidebar and truncated by
the panel width.

## Scope

- Before deleting, the refs store calls the existing `worktree_list` command
  (`git worktree list --porcelain`) and detects whether the branch is checked out
  in another worktree (no parsing of localized stderr). No Rust change needed.
- Show a localized (`en`/`es`) message naming the branch and the worktree path,
  with wrapping so it is not clipped.
- Optional action to remove that worktree: deferred (see Out of scope).

## Acceptance criteria

- [x] Deleting a branch used by a worktree shows the friendly message, not raw stderr.
- [x] Long paths wrap inside the sidebar.
- [x] Vitest tests for the store; i18n keys in both catalogs.
- [x] `npm run lint`, `npm run typecheck`, `npm run test` are green (no Rust changes).

## Out of scope

- A button to remove the blocking worktree.
- Force-deleting branches (`branch -D`) without confirmation.
