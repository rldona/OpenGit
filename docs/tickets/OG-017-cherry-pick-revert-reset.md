# OG-017 · Cherry-pick, revert and soft reset

- **Milestone:** M3 — Advanced history
- **Status:** done
- **Depends on:** OG-004, OG-010
- **References:** ROADMAP.md, AGENTS.md

## Context

Rewrite history in a controlled way from the graph: bring a commit to the current branch, undo one already published, or move the branch to an earlier point without losing the files.

## Scope

- Cherry-pick of the selected commit onto the current branch.
- Revert of the selected commit (creates the revert commit, with `--no-edit`).
- Soft reset (`--mixed`) of the current branch to the selected commit: moves HEAD and unstages, without touching the working tree.
- Explicit confirmation on all three actions, with a special warning on reset.
- Clear conflict errors: the state remains visible (in-progress operation banner) and the process does not silently stop halfway.

## Acceptance criteria

- [x] Cherry-pick brings the commit changes and keeps the original message. _(test)_
- [x] A conflicting cherry-pick fails with a readable error and leaves the repo in cherry-pick state (abortable from the terminal; M4 adds the UI). _(test that aborts afterwards)_
- [x] Revert creates a "Revert ..." commit that undoes the change. _(test)_
- [x] Mixed reset moves the branch, keeps the files on disk and leaves the changes unstaged. _(test)_
- [x] All three actions ask for confirmation and refresh graph, refs and status. _(native confirmation + refreshes in the store and UI test)_

## Out of scope

- `--hard` reset (destructive; never by default).
- Cherry-pick of ranges or multiple commits.
- Abort/continue from the UI (arrives with M4).

## Technical notes

- Commands: `git cherry-pick <hash>`, `git revert --no-edit <hash>`, `git reset --mixed <hash>`.
- The hash is validated (hex, 4-64) before being used as an argument.
- All operations pause the watcher and refresh when finished.

## Implementation notes (2026-09-18)

- Rust: `cherry_pick`, `revert_commit` and `reset_mixed` in `git/mod.rs` with hash validation; equivalent Tauri commands with `pause_while`.
- UI: buttons in the commit detail (Cherry-pick, Revert, Reset to here) with native confirmation and a specific warning on reset; errors appear in the Output panel and the in-progress operation banner (OG-007) warns about the unfinished cherry-pick.
- After every action log, refs and status are refreshed (in addition to the watcher).
- Tests: Rust (pick, conflict, revert, mixed reset, invalid hash) and frontend (store and buttons).
- Closed on 2026-09-18 with green CI (Frontend 32 s, Rust 1m21s) in PR #13.
