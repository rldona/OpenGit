# OG-086 · Create (init) a repository

- **Milestone:** M16 — Repository lifecycle
- **Status:** done
- **Depends on:** OG-003
- **References:** `src-tauri/src/git/`, `src/lib/bridge/`

## Context

The other half of the lifecycle: with no repository on disk there is no way to
start one from the app. `git init` lives in the terminal.

## Scope

- Rust `init_repo` command: `git init` with an initial branch name, plus an
  optional first commit and an optional `.gitignore` template.
- Frontend: a Create dialog (destination picker, initial branch, "create first
  commit", `.gitignore` template selector).
- On success, open the new repository in a tab.

## Acceptance criteria

- [x] Creating a repository in an empty or non-existent folder opens it in a
  tab with the chosen initial branch.
- [x] The optional first commit and `.gitignore` are written when selected and
  skipped otherwise.
- [x] A non-empty folder (which includes an existing repository), a missing
  parent folder or an unwritable destination produces a readable message and
  changes nothing; the initial commit needs a configured identity and reports
  it otherwise.
- [x] Rust tests with temporary directories; no network.
- [x] `npm run typecheck`, `lint`, `format:check`, `test` and the Rust checks
  green.

## Out of scope

- A gallery of project templates (language scaffolding).
- License or README generation.
- Initialising inside an existing repository (`git init` again).

## Technical notes

- The initial branch uses `git init -b <name>`; default `main`.
- The first commit needs a local identity; if none is configured, report it
  instead of failing with a raw git error (reuse the Settings identity, OG-067).
- `.gitignore` templates are plain files bundled with the app; no dependency.

## Implementation notes (2026-09-20)

- `repo::init`: validates the destination (empty/nonexistent, parent exists),
  validates the branch name with `git check-ref-format`, runs
  `git init -b <branch> <path>`, optionally writes the `.gitignore` and
  optionally creates an `Initial commit` (`add -A` + `commit --allow-empty`),
  checking the identity first.
- Templates live in `src-tauri/templates/gitignore/*.txt` and are embedded with
  `include_str!`; `repo::gitignore_templates` exposes their id and name.
- Commands `init_repo` and `gitignore_templates`; the `CreateDialog` (parent
  picker, folder name, initial branch, template, first-commit checkbox) opens
  the new repository afterwards; File → **Create Repository…**.
- Tests: integration tests for creation without history, with template and
  first commit, and rejection of a non-empty destination; `CreateDialog` tests
  (options, disabled state, failure) and the menu route.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (67 files, 503
  tests), full `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check`.
