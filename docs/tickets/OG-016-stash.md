# OG-016 · Stash

- **Milestone:** M3 — Advanced history
- **Status:** done
- **Depends on:** OG-009, OG-010
- **References:** docs/architecture/overview.md

## Context

The sidebar has a Stashes slot with no functionality. Saving and recovering work in progress without fear is part of the daily flow.

## Scope

- List stashes with message, date and reference.
- Create a stash (optional message, optionally include untracked).
- Apply and pop with conflict handling: if it fails, the stash is kept.
- Drop with explicit confirmation.
- Refresh after the watcher and after every operation.

## Acceptance criteria

- [x] Creating a stash leaves the working tree clean and it appears in the sidebar with its message. _(Rust test + UI)_
- [x] `--include-untracked` also saves untracked files. _(test)_
- [x] Apply restores the changes without deleting the stash; Pop applies and deletes it. _(tests)_
- [x] If apply/pop hits a conflict, the error is clear and the stash still exists. _(test with a real conflict)_
- [x] Drop asks for confirmation and only then deletes. _(native confirmation + test)_

## Out of scope

- Preview of the stash diff (to be considered later).
- Stash by hunks.

## Technical notes

- List: `git stash list --format=... -z` with NUL separators.
- Create: `git stash push [--include-untracked] [-m msg]`; apply: `git stash apply <ref>`; pop: `git stash pop <ref>`; delete: `git stash drop <ref>`.
- The reference is validated (`stash@{n}`) before being used as an argument.

## Implementation notes (2026-09-18)

- Rust: `stash_list`, `stash_push`, `stash_apply(drop)` and `stash_drop` with reference validation; equivalent commands that pause the watcher.
- UI: `StashSidebar` replaces the placeholder: create (message + include untracked), and per stash Apply / Pop / Drop with confirmation; refresh of refs/status/graph after every operation.
- Tests: Rust (create/list/apply/pop/drop, untracked, conflict keeps the stash) and frontend (store and sidebar).
- Closed on 2026-09-18 with green CI (Frontend 30 s, Rust 1m13s) in PR #12, together with OG-015.
