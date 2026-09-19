# OG-020 · Block-based conflict editor

- **Milestone:** M4 — Rebase and conflicts
- **Status:** done
- **Depends on:** OG-005, OG-019
- **References:** ROADMAP.md

## Context

With the operations banner (OG-019) it is already possible to abort or continue, but resolving a conflict forces you to edit the file by hand. A view that shows the conflicting blocks and lets you choose a side per block is missing.

## Scope

- List of conflicting files (the `unmerged` ones from `git status`).
- Block view reading the markers of the working file (`<<<<<<<`, `=======`, `>>>>>>>` and `|||||||` if the user uses `diff3`).
- Per block: **Take ours**, **Take theirs** and **Take both**, with the option to undo the choice.
- Common blocks shown as context.
- Save and `git add` the resolved file; saving with unresolved blocks is not allowed.
- When there are no conflicts left, a warning to continue the operation from the banner (OG-019).
- Binary or non-UTF-8 files: warning and resolution outside the app.

## Acceptance criteria

- [x] A conflicting merge lists its files and shows the blocks with ours/theirs. _(parser, store and UI tests)_
- [x] Choosing a side per block builds the exact resolved content (including the final newline). _(tests of `resolvedContent`)_
- [x] Saving stages the file and it disappears from conflicts. _(Rust test with a real merge)_
- [x] With unresolved blocks, saving is rejected with a clear message. _(test + disabled button)_
- [x] When the last file is resolved, a warning says the operation can be continued. _(message in Output)_

## Out of scope

- Free editing of the content (only per-block choice).
- Resolution of delete/modify without markers (a warning is shown and it is resolved outside).
- Binary conflicts.

## Technical notes

- The working file is read as is (it already contains the markers) instead of recomposing from stages `:1:/:2:/:3:`; simpler and respects the user's `merge.conflictStyle`.
- Parsing and building the result are pure functions with tests.
- The path is validated (relative, without `..`) before reading or writing.

## Implementation notes (2026-09-18)

- Rust: `read_worktree_file` and `write_and_stage` in `repo/ops.rs`; `read_conflict_file` and `resolve_conflict` commands.
- Frontend: `lib/conflict/parse.ts` (blocks + reconstruction), `stores/conflict.ts` and `ConflictView` with per-block actions; it is entered from the Conflicts section of File status.
- While at it, the commit panel no longer lists conflicting files as staged (bug detected by the tests).
- Closed on 2026-09-18 with green CI (Frontend 32 s, Rust 1m27s) in PR #16.
