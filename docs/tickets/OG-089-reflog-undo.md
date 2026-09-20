# OG-089 · Reflog view with restore/reset (undo)

- **Milestone:** M17 — Recovery and debugging
- **Status:** done
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

- [x] The reflog lists entries newest first with selector and subject.
- [x] Creating a branch at an entry leaves the working tree untouched.
- [x] Resetting to an entry asks for confirmation when it is destructive
      (hard), and the mode is chosen in the view.
- [x] Tests: the parser/list with a temporary repository; the store and the view
      cover the actions.
- [x] Checks green.

## Out of scope

- A generic multi-step undo stack.
- Expiring or deleting reflog entries.

## Technical notes

- Parse with `-z`/`--format` separators, never localized output (rule 4).
- Destructive resets go through the existing confirmation and are never the
  only path (rule 1).

## Implementation notes (2026-09-20)

- Rust: `reflog` reads `git reflog --format` with `\x1f` field separators
  (`%H`, `%gd`, `%gs`, `%an`, `%at`) and a parser tolerant of empty lines.
- Frontend: a `reflog` store and a **Reflog** view in the Workspace sidebar.
  Each entry offers create branch (inline name), reset (soft/mixed/hard, hard
  confirmed), checkout and copy hash; the view reloads after each action.
- Tests: the Rust list; the store (load, create branch, reset) and the view.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (72 files, 524
  tests), `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check`.
