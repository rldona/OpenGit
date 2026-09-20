# OG-030 · Stash diff

- **Milestone:** M5 — Polish (v2 of OG-016)
- **Status:** done
- **Depends on:** OG-016, OG-005
- **References:** ROADMAP.md

## Context

The stash sidebar allows apply, pop and drop, but there is no way to see what a stash contains before touching it.

## Scope

- Backend: `stash_show` runs `git stash show -p --include-untracked <ref>` (includes untracked files saved with `-u`) and validates the reference like the rest of the stash operations.
- UI: **Diff** button per stash that opens a dialog with the full patch in the diff editor in unified and read-only mode, with close.
- Dialog states: loading, error and "No changes in this stash".
- No applying the stash, no staging and no editing.

## Acceptance criteria

- [x] A stash with tracked and untracked changes shows both in the patch.
- [x] An invalid reference fails with `InvalidOutput` without running git.
- [x] Closing the dialog clears the reference and the patch.
- [x] Tests: Rust integration, store and sidebar.

## Out of scope

- File list with per-file diff and stage from the stash.
- Comparing a stash with another reference or with the working tree.
- Editing the patch.

## Technical notes

- `--include-untracked` in `stash show` requires git ≥ 2.32; the project minimum is 2.34.
- The patch is shown with `DiffEditor` (CodeMirror) in unified mode; it is the same component as the normal diff, without staging actions.
- The diff state lives in the stash store (`diffReference`, `diffPatch`, `diffLoading`, `diffError`) so that the sidebar and the dialog are not coupled.

## Implementation notes (2026-09-18)

- Rust: `stash_show` reuses `validate_stash_reference`; integration test with tracked + untracked and invalid reference.
- Frontend: **Diff** button in each sidebar row, `StashDiffDialog` with unified read-only `DiffEditor`; loading, error and "No changes in this stash" states.
- Tests: 112 Rust (2 new) and 184 frontend (4 new between store and sidebar; the previous store tests were preserved when merging the file).
- Closed on 2026-09-18 with green CI (Frontend 38 s, Rust 1m30s) in PR #27.
