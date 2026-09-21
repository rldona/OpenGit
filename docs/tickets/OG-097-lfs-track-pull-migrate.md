# OG-097 · Git LFS: track, pull and migration

- **Milestone:** M19 — Git LFS & hooks
- **Status:** done
- **Depends on:** OG-025
- **References:** `.ai/skills/git-cli-parsing/SKILL.md`, `.ai/skills/tauri-ipc/SKILL.md`

## Context

OG-025 made LFS visible (installed/version/configured) and warns when the
repository uses `filter=lfs` but `git-lfs` is missing, yet the app cannot do
anything else: it cannot track a pattern, download objects or migrate existing
files. Everything about LFS still needs the terminal.

## Scope

- Extend `LfsStatus` with the active `filter=lfs` patterns read from tracked
  `.gitattributes` files (including nested ones and their directory prefix).
- `lfs_track(path, pattern)`: runs `git lfs track` for a validated pattern,
  writing `.gitattributes`. Rejects empty patterns and patterns starting with
  `-`; the pattern goes as a single argv element, never through a shell.
- Streaming jobs (same machinery as fetch/pull/push) for:
  - `lfs pull` (download the missing objects for the checked-out ref).
  - `lfs migrate import` over an include pattern (rewrite history to LFS),
    which is destructive and requires explicit confirmation in the UI.
- UI, in the existing **Git LFS** section of the extras sidebar:
  - show the tracked patterns (or "not configured" when there are none);
  - context menu with *Track pattern…*, *Pull objects* and *Migrate to LFS…*;
  - the migration asks for the include pattern and warns that it rewrites
    history; output streams to the output panel and can be cancelled.

## Acceptance criteria

- [x] `LfsStatus.patterns` collects active `filter=lfs` patterns, including
      nested `.gitattributes`, and ignores commented ones.
- [x] Tracking a valid pattern runs `git lfs track <pattern>`; empty or
      leading-`-` patterns fail with a readable error and run nothing.
- [x] `lfs pull` and `lfs migrate import` are constructed as jobs with output
      streaming and cancellation; the migration command is never built without
      an include pattern.
- [x] When `git-lfs` is not installed, tracking returns a clear error instead
      of failing halfway.
- [x] Tests: parser with real `.gitattributes` fixtures; `command_for` for the
      new job kinds; tracking validation in a temporary repository; frontend
      with the bridge mocked.
- [x] `npm run lint`, `npm run typecheck`, `npm run test`, `cargo test`,
      `cargo clippy -D warnings` and `cargo fmt --check` green.

## Out of scope

- `git lfs install` (hooking LFS into the repo) as a separate action; it is not
  needed to track/pull once `git-lfs` is installed.
- LFS push/prune/gc and remote locking.
- Showing the real content of an LFS file in the diff (the pointer warning from
  OG-025 stays).

## Technical notes

- `git lfs track` is its own parser, not a git builtin: the pattern is passed as
  a single argument and validated first (non-empty, no leading `-`), so a value
  such as `--force` can never become an option. `--` is avoided because git-lfs
  does not document it as a separator.
- Reuse the pattern parser for both `LfsStatus.patterns` and the migration
  dialog, so what we show is what we would track.
- `git lfs migrate import --include=<glob>` rewrites history and is not
  reversible in place: confirm explicitly, list it as destructive and do not
  run it by accident from a context menu alone.
- The machine is not required to have `git-lfs` for the unit tests; job
  construction and parsers are tested without executing LFS.

## Implementation notes (2026-09-21)

- Rust: `parse_lfs_patterns` reads active `filter=lfs` lines (comments, macros
  and blank lines ignored; quoted patterns unquoted) and `lfs_status` prefixes
  each with its `.gitattributes` directory, deduplicated.
- `lfs_track` validates the pattern and, only then, checks `git lfs version` so
  an invalid pattern fails before anything runs; an unsafe pattern never
  reaches git.
- New job kinds `lfs_pull` and `lfs_migrate`, built by `command_for` through the
  existing streaming/cancellation machinery (`git lfs migrate import
  --include=<glob>` never built without a pattern).
- Frontend: patterns listed in the Git LFS section (visible when installed or
  configured), context menu with *Track pattern…*, *Pull objects* and *Migrate
  to LFS…*; `LfsDialog` handles both, and the LFS jobs refresh the extras store.
- Tests: `parse_lfs_patterns` fixtures, `command_for` for both jobs (including
  the empty-pattern and option-like-remote rejections), a temporary repository
  for the pattern prefixing and validation, the sidebar interactions and the
  job titles. Verified `lint`, `typecheck`, `format:check`, `npm test` (532),
  `cargo test`, `cargo clippy -D warnings` and `cargo fmt --check`.
