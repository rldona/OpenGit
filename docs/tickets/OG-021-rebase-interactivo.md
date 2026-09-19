# OG-021 · Visual interactive rebase

- **Milestone:** M4 — Rebase and conflicts
- **Status:** done
- **Depends on:** OG-004, OG-019, OG-020
- **References:** ROADMAP.md

## Context

Last piece of M4: rewriting a series of commits (reorder, join, discard, rename) with a plan visible before executing and without going through the git editor.

## Scope (v1)

- **Interactive rebase from here** action on a graph commit: the plan is the commits from HEAD to that point (excluded), in order.
- Actions per commit: **pick**, **reword**, **squash**, **fixup** and **drop**.
- Reorder with move up/down.
- **Simple reword**: a single message for the whole plan (only one `reword` is allowed); the message is applied with `exec git commit --amend -F`.
- Plan preview and confirmation before executing (it rewrites history).
- If there are conflicts, the rebase stays in progress and the banner (OG-019) and the editor (OG-020) apply.
- Abort available at all times.

## Acceptance criteria

- [x] The plan lists the correct commits (base excluded) and allows reordering and choosing an action. _(tests)_
- [x] Squash/fixup join commits and preserve the final content. _(test: squash keeps the subject of the previous commit and adds the message of the next one to the body)_
- [x] Drop removes the changes of the discarded commit. _(test)_
- [x] Reword changes the message of the marked commit (one message per plan). _(test)_
- [x] A conflict leaves the rebase in progress and it can be aborted. _(test)_
- [x] Confirmation before executing and refresh of graph/refs/status when finished. _(UI and store test)_

## Out of scope

- A different message for each reword (v2).
- `edit` (stop at a commit), autosquash and execution of arbitrary commands.
- Rebase onto published branches beyond the warning.

## Technical notes

- The todo-list is injected with `GIT_SEQUENCE_EDITOR="cp '<todo>'"`; the file (and the reword message) live in the app data directory, never in the repo.
- Reword does not use the `reword` action (which opens an editor) but `exec git commit --amend -F <message>` so as not to interfere with squash's default messages.
- The plan is obtained with `git log --reverse --format=%H%x1f%s <base>..HEAD`.
- The hashes are validated (hex) before being used.

## Implementation notes (2026-09-18)

- Rust: `rebase_plan` and `interactive_rebase` (todo-list in the data directory, a single validated reword, long timeout); `rebase_plan` and `interactive_rebase` commands.
- UI: `RebaseView` with the plan (action per row, move up/down, message if there is a reword) and confirmation; it is entered from the commit detail in the graph.
- Tests: Rust (plan, squash+fixup, drop, reword, reorder, conflict and abort) and frontend (store and view).
- With this, M4 is complete (multiple reword is left for a v2). Closed on 2026-09-18 with green CI (Frontend 32 s, Rust 1m38s) in PR #17.
