# OG-096 · Cherry-pick several commits or a range

- **Milestone:** M18 — History and content search depth
- **Status:** done
- **Depends on:** OG-017
- **References:** `src-tauri/src/git/`, `src/components/HistoryView.tsx`

## Context

Cherry-pick (OG-017) moves one commit. Porting a fix usually means several
commits or a contiguous range, which today requires repeating the action or
using the terminal.

## Scope

- Allow selecting several commits in the log (or a `A^..B` range) and
  cherry-pick them in order with a single action.
- Optional `-x` (record the source commit in the message).
- On conflict, stop at the failing commit and leave the existing continue/skip/
  abort flow (OG-019) in charge.

## Acceptance criteria

- [x] Cherry-picking a range applies the commits in the right order.
- [x] `-x` appends the source reference to the messages.
- [x] A conflict stops the sequence and the existing banner offers
      continue/skip/abort (the command reports `conflicted` and leaves the
      operation state).
- [x] Tests with temporary repositories (several commits, a range and `-x`; the
      single-commit conflict case is already covered).
- [x] Checks green.

## Out of scope

- Reordering or editing the commits while cherry-picking.
- Cherry-picking across repositories.

## Technical notes

- Pass the revs as separate argv elements after `--`; validate each with
  `validate_ref_name`/`rev-parse` before starting.
- Keep it a single `git cherry-pick` invocation for a contiguous range so git
  handles sequencing and conflicts.

## Implementation notes (2026-09-20)

- Rust `cherry_pick_range`: one `git cherry-pick [-x] --end-of-options <revs…>`
  call; each rev is trimmed and rejected if it starts with `-`, and a
  `conflicted` result is returned instead of an error.
- Frontend: `cherryPickRange` in the log store and `useCommitActions`; when two
  commits are selected in the log, the context menu offers **Cherry-pick
  selected commits** and the `-x` variant.
- Tests: Rust integration (several commits, `main..feature` range, `-x`) and the
  log store output/conflict cases.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (70 files, 517
  tests), `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check`.
