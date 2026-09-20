# OG-085 · Clone a repository from the app

- **Milestone:** M16 — Repository lifecycle
- **Status:** done
- **Depends on:** OG-003, OG-011
- **References:** `src-tauri/src/git/`, `src-tauri/src/jobs/`, `src/lib/bridge/`, `docs/architecture/overview.md`

## Context

OpenGit can only open folders that are already repositories: to get a project
you have to run `git clone` in a terminal first. That is the most visible gap in
the daily flow and the natural first ticket of M16.

## Scope

- Rust `clone_repo` command that runs `git clone` with an **argv array** (never a
  shell), streaming stderr progress and cancellable, reusing the streaming jobs
  of OG-011 where possible.
- Options: source URL, destination path, `--depth`, `--branch`,
  `--recurse-submodules` and `--no-single-branch` when needed.
- Credentials delegated to the system credential helper; nothing stored by the
  app.
- Frontend: a Clone dialog (URL, destination picker, options) and a progress
  window with cancel, following the existing remote-job UI.
- On success, open the cloned repository in a new tab; on failure, a readable
  error and no half state.

## Acceptance criteria

- [x] Cloning a URL from the dialog opens the repository in a tab when it
  finishes (validated with a local bare repository; the same code path serves
  `https://` and `ssh://`).
- [x] Progress is streamed and the clone can be cancelled through the shared
  job manager.
- [x] Empty URL, non-empty destination, a missing parent folder and a file as
  destination produce readable errors before spawning git; authentication
  failures surface through the existing remote error mapper.
- [x] The URL and destination are passed as single argv elements; no shell
  interpolation.
- [x] Rust unit tests for the argument builder and destination validation, plus
  an offline integration test cloning a local bare repository; frontend tests
  with the bridge mocked.
- [x] `npm run typecheck`, `lint`, `format:check`, `test` and the Rust checks
  green.

## Out of scope

- Hosting-specific authentication screens; the system helper is enough.
- LFS smudge options, mirror/reference clones and partial clones.
- Cloning as a submodule of an open repository.
- A "clone into the current folder" mode.

## Technical notes

- The destination must not exist or must be an empty directory; check it before
  spawning git so the error is immediate and local.
- `git clone --progress` writes progress to stderr even when not a TTY; parse it
  the same way as fetch/pull/push (OG-011), without assuming a locale.
- Treat the URL as untrusted input: never build a command string from it.

## Implementation notes (2026-09-20)

- `jobs`: new `JobKind::Clone` reusing the streaming job infrastructure; the
  working directory is derived from the destination's parent, and `clone_cwd`
  validates the URL/destination before spawning.
- `remote` store: remembers the clone destination and opens the repository in a
  tab when the job finishes; the shared `RemoteJobModal` shows progress and
  errors.
- Frontend: `CloneDialog` (URL, parent folder picker, folder name derived from
  the URL, depth/branch/submodules options) and a File → **Clone Repository…**
  menu entry. Helpers live in `lib/clone.ts`.
- Tests: `jobs` unit tests (args + validation), an offline integration test
  cloning a local bare repository, `CloneDialog`/`clone` helper tests, the
  remote store clone-success case and the menu route.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (65 files, 499
  tests), `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check`.
