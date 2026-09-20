# OG-096 · Cherry-pick several commits or a range

- **Milestone:** M18 — History and content search depth
- **Status:** ready
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

- [ ] Cherry-picking a range applies the commits in the right order.
- [ ] `-x` appends the source reference to the messages.
- [ ] A conflict stops the sequence and the banner offers continue/skip/abort.
- [ ] Tests with temporary repositories (clean range and a conflict).
- [ ] Checks green.

## Out of scope

- Reordering or editing the commits while cherry-picking.
- Cherry-picking across repositories.

## Technical notes

- Pass the revs as separate argv elements after `--`; validate each with
  `validate_ref_name`/`rev-parse` before starting.
- Keep it a single `git cherry-pick` invocation for a contiguous range so git
  handles sequencing and conflicts.
