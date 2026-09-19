# OG-019 · Operation state and Abort/Continue

- **Milestone:** M4 — Rebase and conflicts
- **Status:** done
- **Depends on:** OG-007, OG-017
- **References:** ROADMAP.md

## Context

Today a merge, rebase, cherry-pick or revert left halfway only leaves a warning and the commit disabled. Seeing the state globally and being able to finish or cancel the operation from the app is missing.

## Scope

- Detect merge, rebase, cherry-pick and revert in progress, with the current rebase step (e.g. 2/5).
- Global banner visible in any view with the operation and the progress.
- **Abort** and **Continue** buttons; Continue accepts the default message without opening an editor.
- Clear errors if there are unresolved conflicts (Continue fails with git's message).
- After Abort/Continue, state, status, refs and graph are refreshed.

## Acceptance criteria

- [x] A conflicting merge shows the banner and Abort cancels it (repo as before the merge). _(test)_
- [x] Continuing a merge after resolving the conflict creates the merge commit. _(test)_
- [x] Aborting a rebase returns the branch to the starting point; the banner shows the step. _(test with 1/1)_
- [x] Continuing a rebase after resolving it completes it. _(test)_
- [x] Conflicting cherry-pick and revert can also be aborted. _(cherry-pick test; revert shares REVERT_HEAD)_
- [x] With no operation in progress, Abort/Continue fail with a clear error (the buttons do not appear). _(test + hidden banner)_

## Out of scope

- Conflict editor (next M4 ticket).
- `--skip` on rebase/cherry-pick.

## Technical notes

- State in `.git`: `MERGE_HEAD`, `rebase-merge`/`rebase-apply` (+ `msgnum`/`end`), `CHERRY_PICK_HEAD`, `REVERT_HEAD`.
- Abort/Continue dispatch to the command of the detected operation; Continue is launched with `GIT_EDITOR=true` to accept the default message.
- All actions pause the watcher and refresh when finished.

## Implementation notes (2026-09-18)

- Rust: `RepoOpState` gains `revert` and the rebase progress (`rebase_current`/`rebase_total`); `repo_op_abort` and `repo_op_continue` dispatch according to the state and fail with an error if there is no operation.
- UI: global `OpBanner` (below the toolbar) with the operation, the step and the Abort/Continue buttons; the commit panel no longer duplicates the warning.
- Tests: Rust (merge abort/continue, rebase abort/continue with progress, cherry-pick abort, no operation) and frontend (store and banner).
- Closed on 2026-09-18 with green CI (Frontend 34 s, Rust 1m54s) in PR #15.
