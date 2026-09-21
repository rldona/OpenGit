# OG-097 · Git LFS: track, pull and migration

- **Milestone:** M19 — Git LFS & hooks
- **Status:** in-progress
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

- [ ] `LfsStatus.patterns` collects active `filter=lfs` patterns, including
      nested `.gitattributes`, and ignores commented ones.
- [ ] Tracking a valid pattern builds `git lfs track -- <pattern>`; empty or
      leading-`-` patterns fail with a readable error and run nothing.
- [ ] `lfs pull` and `lfs migrate import` are constructed as jobs with output
      streaming and cancellation; the migration command is never built without
      an include pattern.
- [ ] When `git-lfs` is not installed, the actions return a clear error instead
      of failing halfway.
- [ ] Tests: parser with real `.gitattributes` fixtures; `command_for` for the
      new job kinds; tracking validation in a temporary repository; frontend
      with the bridge mocked.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `cargo test`,
      `cargo clippy -D warnings` and `cargo fmt --check` green.

## Out of scope

- `git lfs install` (hooking LFS into the repo) as a separate action; it is not
  needed to track/pull once `git-lfs` is installed.
- LFS push/prune/gc and remote locking.
- Showing the real content of an LFS file in the diff (the pointer warning from
  OG-025 stays).

## Technical notes

- `git lfs track` is its own parser, not a git builtin: pass the pattern as a
  single argument after `--` and validate it first, so a value such as
  `--force` can never become an option.
- Reuse the pattern parser for both `LfsStatus.patterns` and the migration
  dialog, so what we show is what we would track.
- `git lfs migrate import --include=<glob>` rewrites history and is not
  reversible in place: confirm explicitly, list it as destructive and do not
  run it by accident from a context menu alone.
- The machine is not required to have `git-lfs` for the unit tests; job
  construction and parsers are tested without executing LFS.

## Implementation notes

_(filled in when the ticket closes)_
