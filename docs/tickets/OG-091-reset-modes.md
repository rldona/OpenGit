# OG-091 · Reset modes (soft, mixed, hard)

- **Milestone:** M17 — Recovery and debugging
- **Status:** done
- **Depends on:** OG-017
- **References:** `src-tauri/src/git/`, `src/components/HistoryView.tsx`

## Context

The app only offers a soft reset (`--mixed`, OG-017). SourceTree users expect
soft, mixed and hard, with hard clearly marked as destructive.

## Scope

- Extend the reset command to take the mode: `--soft`, `--mixed`, `--hard`.
- UI: choose the mode when resetting to a commit; `--hard` asks for an explicit
  confirmation that names the branch/commit and warns about lost changes.

## Acceptance criteria

- [x] Each mode leaves the index and working tree as git defines it.
- [x] Hard reset cannot be triggered without the confirmation.
- [x] Errors (dirty tree, invalid rev) are readable.
- [x] Tests with temporary repositories for the three modes.
- [x] Checks green.

## Out of scope

- Reset to a path (`git reset <rev> -- <paths>`).
- Undo of a hard reset (covered by OG-089).

## Technical notes

- Reuse the existing reset command and its confirmation flow; add the mode as a
  parameter instead of a new command.
- `--hard` is in the destructive list of rule 1.

## Implementation notes (2026-09-20)

- Rust: `ResetMode` (`--soft`/`--mixed`/`--hard`) and `reset`; `reset_mixed`
  now delegates to `reset(.., Mixed)`. The `reset_to` command replaces
  `reset_mixed`.
- Frontend: `resetTo(path, hash, mode)`; the commit context menu offers **Soft**,
  **Mixed** and **Hard** reset, and hard goes through the destructive
  confirmation that names the branch and warns about discarded changes.
- Tests: an integration test asserts the index/worktree of the three modes; the
  log store test covers the mode passthrough.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (70 files, 519
  tests), `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check`.
