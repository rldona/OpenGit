# OG-089 · Reflog view with restore/reset (undo)

- **Milestone:** M17 — Recovery and debugging
- **Status:** backlog
- **Depends on:** OG-003, OG-004
- **References:** `src-tauri/src/git/`, `src/components/`

## Context

A bad reset, rebase or deleted branch is recoverable with the reflog, but today
that means the terminal. The app should show the reflog and let the user act on
an entry.

## Scope

- Rust command to list the reflog with `--format` separators (hash, selector,
  subject, author, date).
- A view listing the entries; actions on an entry: **create branch here**,
  **reset to here** (soft/mixed/hard, hard with confirmation) and **copy hash**.
- Refresh after the action and a readable error otherwise.

## Acceptance criteria

- [ ] The reflog lists entries newest first with selector and subject.
- [ ] Creating a branch at an entry leaves the working tree untouched.
- [ ] Resetting to an entry asks for confirmation when it is destructive.
- [ ] Tests: parser with a real fixture; actions with temporary repositories.
- [ ] Checks green.

## Out of scope

- A generic multi-step undo stack.
- Expiring or deleting reflog entries.

## Technical notes

- Parse with `-z`/`--format` separators, never localized output (rule 4).
- Destructive resets go through the existing confirmation and are never the
  only path (rule 1).
