# OG-031 · Discard hunks and lines (per-hunk inversion)

- **Milestone:** M5 — Polish (v2 of OG-006)
- **Status:** done
- **Depends on:** OG-006, OG-009
- **References:** ROADMAP.md

## Context

Partial stage/unstage (OG-006) already allows hunks and lines in both directions, but **discarding** changes only exists at the whole-file level (File status). There is no way to undo a specific piece of the working tree without discarding the entire file.

## Scope

- Backend: `discard_selection` builds the patch for the selection from the unstaged diff and applies it **in reverse to the working tree** (`git apply --reverse`), via stdin, without touching the index.
  - `HunkSelection::File` is not accepted here: full discard already exists in File status.
- UI: **Discard hunk** button next to Stage hunk and **Discard N line(s)** when there are selected lines, both with destructive confirmation (same pattern as File status) and only on the unstaged side.
- Associated fix: with the inverted view (**Reverse**) active, the stage/unstage/discard actions are hidden, because the hunk/line indices belong to the inverted patch and do not correspond to the diff that git re-reads in the backend.
- After discarding: the patch and the working tree status are refreshed.

## Acceptance criteria

- [x] Discarding a hunk removes only that hunk and preserves the rest of the file's changes.
- [x] Discarding selected lines preserves the unselected ones.
- [x] Cancelling the confirmation does not run git.
- [x] With Reverse active, no stage or discard actions are offered.
- [x] Tests: Rust integration, store, PatchView and DiffView.

## Out of scope

- Discarding a whole file from the diff (already in File status).
- Undoing a discard (there is no undo; confirmation is the safety net).
- Discarding staged changes (unstage is for that).

## Technical notes

- Reuses `worktree_diff_bytes` + `ParsedPatch::build`; only the applier changes (`apply_worktree_patch`, without `--cached`).
- `git apply --reverse` on the working tree requires the content to match the patch; if something changed in between, git fails and the error is shown.
- The confirmation lives in `DiffView` (as in `StatusView`), not in the store.

## Implementation notes (2026-09-18)

- Rust: `discard_selection` + `apply_worktree_patch` (without `--cached`); both appliers (index and worktree) pass `--unidiff-zero` because a per-line cut can leave the hunk edge without context and git rejected it. Noted in `.ai/memory/git-quirks.md`.
- UI: **Discard hunk** button in the patch and **Discard N line(s)** in the toolbar, both with destructive confirmation; discard only appears on the unstaged side.
- Fix: with **Reverse** active, stage/unstage/discard are hidden (the inverted patch indices do not correspond to the diff that the backend re-reads).
- Tests: 114 Rust (2 integration) and 191 frontend (7 between store, PatchView and DiffView).
- Closed on 2026-09-18 with green CI (Frontend 27 s, Rust 2m11s) in PR #28.
