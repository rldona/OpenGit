# OG-091 · Reset modes (soft, mixed, hard)

- **Milestone:** M17 — Recovery and debugging
- **Status:** backlog
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

- [ ] Each mode leaves the index and working tree as git defines it.
- [ ] Hard reset cannot be triggered without the confirmation.
- [ ] Errors (dirty tree, invalid rev) are readable.
- [ ] Tests with temporary repositories for the three modes.
- [ ] Checks green.

## Out of scope

- Reset to a path (`git reset <rev> -- <paths>`).
- Undo of a hard reset (covered by OG-089).

## Technical notes

- Reuse the existing reset command and its confirmation flow; add the mode as a
  parameter instead of a new command.
- `--hard` is in the destructive list of rule 1.
