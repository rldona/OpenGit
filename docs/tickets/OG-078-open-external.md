# OG-078 · Open working-tree files in external applications

- **Milestone:** Next (post-M8)
- **Status:** done
- **Depends on:** OG-038
- **References:** `src/components/StatusView.tsx`, `src/components/DiffFilesPanel.tsx`, `src-tauri/src/commands.rs`

## Context

Files can be previewed inside the app, but there is no way to open them
in the machine's applications (default app, VS Code) or reveal them in
the file manager. The building blocks exist (`open_path` command,
`revealItemInDir`), they are just not wired to the file rows.

## Scope

- New `open_editor` Rust command launching VS Code (`code <file>`,
  argv array, no shell) with per-platform candidate paths plus the PATH
  fallback; readable error when the file is missing or no VS Code is
  found. Registered in `generate_handler!`.
- `openEditor` bridge next to `openPath`.
- File context menus (Status rows and diff file list, worktree targets
  only): **Open** (default app), **Open in VS Code**, **Show in Finder**.
  Failures surface in the Output panel, never as crashes.
- Commit/compare file lists keep no external actions (content may not
  match disk).

## Acceptance criteria

- [x] Right-clicking a worktree file offers the three actions in Status
  and in the diff file list.
- [x] Open launches the default app; Reveal selects the file in the
  manager; VS Code opens the file or reports a readable error.
- [x] No actions on commit/compare entries.
- [x] `npm run typecheck`, `npm run lint`, `npm test`, `cargo test`,
  `cargo clippy -D warnings`, `cargo fmt --check` green.

## Out of scope

- Configurable editor command (a fixed VS Code entry is enough for now).
- Double-click behavior changes (still opens the in-app diff).
- `code-insiders` / VSCodium variants.

## Implementation notes (2026-09-20)

- Rust `open_editor`: argv-only spawn, absolute install locations first
  (GUI PATH is minimal), bare `code` last; Windows also tries
  `cmd /c code` with exit-code check (`.cmd` shim). Missing file and
  missing editor are readable `invalid` errors.
- Frontend `lib/openFiles.ts` shared helper (path join, backend message
  preferred over the generic git formatter, failures to the Output
  panel); menus in `StatusView` and `DiffFilesPanel` (worktree-gated).
- Tests: Rust missing-file error path (success would launch a GUI);
  helper unit tests; Status/Diff menu tests incl. commit-target gating.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (59 files,
  463 tests), full `cargo test`, `clippy --all-targets -D warnings`,
  `cargo fmt --check` green.
