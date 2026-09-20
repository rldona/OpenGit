# OG-099 · Hooks manager

- **Milestone:** M19 — Git LFS & hooks
- **Status:** ready
- **Depends on:** OG-067
- **References:** `src-tauri/src/git/mod.rs` (`commit_template_read`/`write`)

## Context

Git hooks decide what happens on commit, push or checkout, but the app never
shows them: to know whether a `pre-commit` exists, is active or what it does,
the user has to leave for the terminal. The commit panel already surfaces hook
output (OG-007); this ticket makes the hooks themselves manageable.

## Scope

- Resolve the hooks directory with `git rev-parse --git-path hooks`, so
  `core.hooksPath` and worktrees are respected; fall back to nothing when it
  does not exist.
- `hooks_list(path) -> Vec<Hook>`: for each hook in the directory, its name,
  absolute path, whether a real hook is installed, whether a `.sample` exists
  and whether it is currently active.
- `hook_read(path, name) -> String`: contents of the hook (empty when it is
  missing); reading a `.sample` is allowed to use it as a starting point.
- `hook_write(path, name, contents)`: writes the hook and marks it executable
  on Unix; a readable error if the name is not a valid hook file name.
- `hook_set_enabled(path, name, enabled)`:
  - enable: materialize the hook from `<name>.disabled` or from the `.sample`
    when the real file is missing, then mark it executable on Unix;
  - disable: on Unix clear the executable bit; on Windows rename to
    `<name>.disabled` (Git for Windows ignores the executable bit).
- UI: a **Hooks** section (Settings or the extras sidebar) listing hooks with
  an active/disabled marker, a preview/edit modal reusing the commit template
  editor, and *Enable*/*Disable*/*Open in editor* actions.

## Acceptance criteria

- [ ] `hooks_list` finds existing hooks, `.sample` files, respects
      `core.hooksPath` and reports the active flag correctly on Unix.
- [ ] `hook_write` rejects names with path separators, `..` or a
      `.sample`/`.disabled` suffix, and writes the file unchanged.
- [ ] Enabling a sample creates a working, executable hook; disabling makes Git
      ignore it without deleting its contents.
- [ ] `hook_read` never escapes the hooks directory.
- [ ] Tests: a temporary repository with a sample and an installed hook
      (resolve, list, toggle), plus the frontend with the bridge mocked.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `cargo test`,
      `cargo clippy -D warnings` and `cargo fmt --check` green.

## Out of scope

- Hooks installed globally (`core.hooksPath` outside the repository) beyond
  listing them read-only.
- Server-side hooks (`pre-receive`, `update`): they only exist on the remote.
- Executing hooks from the app beyond what Git already runs on commit/push.
- A syntax-highlighting editor: a plain textarea is enough.

## Technical notes

- Follow `commit_template_read`/`write`: git makes the directory, but the app
  reads and writes the files; never interpolate the hook name into a shell.
- A hook name is a single path segment: validate with the same rules as a ref
  segment and join it to the resolved directory; the joined path must still be
  a direct child of the hooks directory.
- `git rev-parse --git-path hooks` may return a relative path; resolve it
  against the repository root, like `ignore_exclude_path` does.
- The `.disabled` rename is the portable switch; on Unix also honour the
  executable bit because it is what Git actually checks.

## Implementation notes

_(filled in when the ticket closes)_
