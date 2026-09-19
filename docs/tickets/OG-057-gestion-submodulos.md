# OG-057 · Submodule management

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** ready
- **Depends on:** OG-024, OG-009
- **References:** ROADMAP.md, OG-024

## Context

M5 left submodules in **read-only mode** and the Branches menu shows
`Add Submodule…` disabled. An uninitialized submodule cannot be fixed from the
app (exactly the most common case when cloning), and adding a new one requires
the terminal.

## Scope

- Rust commands: `submodule_update` (`--init --recursive`), `submodule_sync`
  and `submodule_add` (URL + path), with argv and typed errors.
- Per-submodule actions in the sidebar: Update (init included), Sync and Open
  (already exists) depending on its state; the `uninitialized` state gains a
  prominent action.
- "Add Submodule…" dialog from the Branches context menu.
- Git output to the Output panel and refresh of extras/status.

## Acceptance criteria

- [ ] An `uninitialized` submodule is initialized from the sidebar and becomes
      clean.
- [ ] Adding a submodule in a temporary repo registers, clones and lists it.
- [ ] Sync applies the URLs from `.gitmodules` without touching the index.
- [ ] A network or URL failure is shown as an actionable error.
- [ ] Integration tests with a temporary repo and a local submodule
      (`file://`).

## Out of scope

- Editing `.gitmodules` by hand.
- Nested submodules beyond `--recursive`.
- Deinit/absorbing submodules.

## Technical notes

- `git submodule update --init --recursive` can take a while: use the jobs
  pattern if the output is long (or a generous timeout and output to the
  panel).
- After changing a submodule, the parent repo watcher does not always fire:
  refresh extras explicitly.
