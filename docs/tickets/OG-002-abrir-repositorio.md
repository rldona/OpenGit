# OG-002 · Open repository and recents

- **Milestone:** M1 — Local MVP
- **Status:** done
- **Depends on:** OG-001, OG-003
- **References:** docs/architecture/overview.md

## Context

The app's entry point: choose a folder and validate it as a git repository, with a list of recents to return to the usual ones.

## Scope

- Native folder picker (Tauri dialog).
- Validation of the directory as a git repo (includes subfolders of a repo).
- Persisted recents list (path, last opened), with remove from the list.
- Clear error states: not a repo, repo without commits, repo in a weird state (invalid `HEAD`), git not installed or version < 2.34.
- Subfolder detection: offer to open the repo root.

## Acceptance criteria

- [x] Opening a repo with history shows the detected root and enters the main view. _(validation in `repo::open` + view with name, path, branch and HEAD)_
- [x] Empty repo (without commits) opens without errors and with an explicit empty state. _(Rust tests + message in the UI)_
- [x] An insufficient git version produces a readable error, not a crash. _(`GitError::GitTooOld`; no automated test with an old git)_
- [x] Recents persist between restarts and do not contain duplicate paths. _(`recent_repos.json` in the data directory; dedup and reload test)_
- [x] Repo in detached HEAD opens correctly. _(Rust test)_

## Out of scope

- Cloning repositories.
- Bare repos (only a not-supported notice will be shown for now).

## Technical notes

- Validation with the equivalent of `git rev-parse --show-toplevel --is-inside-work-tree -z` (simple output, no path ambiguity) and `git rev-parse --verify HEAD` for "without commits".
- Persistence in the app data directory (Tauri store), never in the user's repo.

## Implementation notes (2026-09-18)

- Rust: `src/repo/` module with `open()` (root, name, commits, branch/detached/HEAD, git version) and `recents::Recents` (JSON, cap of 10, dedup by path). Tauri commands in `src/commands.rs`: `git_version`, `open_repo`, `recent_repos`, `remove_recent_repo`; state in `AppState` (runner + recents).
- Validation: `rev-parse --is-inside-work-tree` distinguishes non-repo (exit ≠ 0), bare (`false`) and work tree (`true`); `symbolic-ref --short -q HEAD` + `rev-parse --verify --quiet HEAD` cover branch, detached, empty repo and invalid HEAD.
- New dependencies justified by the ticket: `tauri-plugin-dialog` (native picker) and `serde_json` (recents persistence).
- UI: button in the toolbar + empty state, recents list in the sidebar (with remove), summary of the opened repo and errors in a banner; all app output goes to the output panel.
- Tests: 7 Rust (repo + recents) and 7 frontend (App and stores); `cargo clippy -D warnings`, `rustfmt`, ESLint, Prettier, `tsc` and build clean.
- Closed on 2026-09-18: CI green (Frontend 18 s, Rust 1m4s) after fixing the lock with `registry=https://registry.npmjs.org/` in the repo's `.npmrc` (the corporate Artifactory broke CI).
