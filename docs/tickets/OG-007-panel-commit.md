# OG-007 · Commit panel

- **Milestone:** M1 — Local MVP
- **Status:** done
- **Depends on:** OG-006, OG-009
- **References:** ADR-0003

## Context

Close the basic cycle: stage, message and commit, with the information needed to trust what is going to be committed.

## Scope

- Message area with character counter and "not empty" validation.
- List of staged changes before committing.
- Amend of the last commit with an explicit rewrite warning.
- Stage and commit of untracked files from the panel.
- Hook output (`pre-commit`, `commit-msg`) visible when they fail.
- Detection of merge/rebase in progress: offer to continue or abort (M4 completes the experience, here only the notice).

## Acceptance criteria

- [x] Normal commit with correct hooks and with a failing hook (readable error with the hook output). _(`command_failed` includes stdout and stderr; test with a failing hook)_
- [x] Amend updates the message and the staged content of the last commit. _(test: the commit counter does not change and the commit tree is updated)_
- [x] Without staged changes, the commit is rejected with a clear message. _(validation in the store, with test)_
- [x] Messages with UTF-8, multiline and quotes reach the commit intact. _(message via stdin with `--file=-`; test comparing `%B` byte by byte)_
- [x] After committing, graph, status and diff reflect themselves (OG-010 watcher event). _(besides the watcher, the store refreshes status and reloads the log when finished)_

## Out of scope

- GPG/SSH signing (will be done if it is ever needed).
- Message templates, co-authors and team trailers (possible M3).

## Technical notes

- The message is passed via stdin or `-F -`, never interpolated in `-m` inside a shell; with `-m` it must be escaped, with stdin it must not.
- `git commit` without `--no-verify`: the user's hooks rule.
- For amend, UI confirmation the first time (rule 1 of AGENTS.md does not apply because it is not irreversibly destructive, but it does rewrite local history).

## Implementation notes (2026-09-18)

- Rust: `git::commit` (message via stdin with `--file=-`, optional `--amend`, without `--no-verify`), `git::last_commit_message` (amend preload) and `git::repo_op_state` (MERGE_HEAD, rebase-merge/-apply, CHERRY_PICK_HEAD/REVERT_HEAD). Commands `commit_message`, `commit_repo` and `repo_op_state`.
- `GitError::CommandFailed` now also carries `stdout`: hooks write their output there and before it was lost. The frontend shows stderr and falls back to stdout if it is empty.
- UI: `CommitPanel` at the foot of File status, with a compact list of what is staged, amend checkbox (with native confirmation and preloaded message), textarea with counter, validations and notice of merge/rebase/cherry-pick in progress (disables the button; continue/abort actions come in M4).
- The stage of untracked is already covered from File status (OG-009); the panel reflects the index live.
- Tests: 5 Rust (UTF-8 multiline, no staged, amend, failing hook, merge in progress) and 10 frontend (store + panel).
- Closed on 2026-09-18 with green CI (Frontend 23 s, Rust 1m4s) in PR #9.
