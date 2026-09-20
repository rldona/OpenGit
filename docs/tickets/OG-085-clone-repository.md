# OG-085 · Clone a repository from the app

- **Milestone:** M16 — Repository lifecycle
- **Status:** ready
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

- [ ] Cloning an `https://` and an `ssh://`/`git@` URL from the dialog opens the
  repository in a tab when it finishes.
- [ ] Progress is streamed and the clone can be cancelled; cancelling leaves no
  partial working tree (or reports it clearly).
- [ ] Invalid URL, authentication failure, destination inside another repo and
  non-empty destination produce readable errors.
- [ ] The URL is passed as a single argv element; no shell interpolation.
- [ ] Rust unit tests for the argument builder and the progress parser;
  frontend tests with the bridge mocked. No network in tests.
- [ ] `npm run typecheck`, `lint`, `format:check`, `test` and the Rust checks
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
