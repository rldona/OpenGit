# OG-086 · Create (init) a repository

- **Milestone:** M16 — Repository lifecycle
- **Status:** ready
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

- [ ] Creating a repository in an empty or non-existent folder opens it in a
  tab with the chosen initial branch.
- [ ] The optional first commit and `.gitignore` are written when selected and
  skipped otherwise.
- [ ] A non-empty folder, an existing repository or a permission error produces
  a readable message and changes nothing.
- [ ] Rust tests with temporary directories; no network.
- [ ] `npm run typecheck`, `lint`, `format:check`, `test` and the Rust checks
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
