# OG-088 · Open a repository in a new window

- **Milestone:** M16 — Repository lifecycle (optional)
- **Status:** done
- **Depends on:** OG-069
- **References:** ADR-0008, `src-tauri/src/commands.rs`, `src/components/RepoTabs.tsx`

## Context

Repositories live in session tabs (OG-069). For side-by-side work, detaching a
tab into its own OS window is a common request, but it changes the app from
"one window, many tabs" to "many windows", which affects shared state and the
watcher. It is optional and starts with a decision.

## Scope

- A **Open in New Window** action on a tab's context menu that opens a second
  window showing that repository.
- Decide and document the model (an ADR): a window per repository vs. windows
  that still share the tab list.

## Acceptance criteria

- [x] The chosen model is recorded in an ADR before implementing (ADR-0008:
      window per repository).
- [x] Opening a repository in a new window shows its history and status there.
- [x] Closing the window does not disturb the main window's tabs.
- [x] The watcher is per window (keyed by label) and removed when the window is
      destroyed; `auto-refresh` stays global.
- [x] Checks green.

## Out of scope

- Multiple windows before the ADR is accepted.
- Window layout/size persistence beyond what Tauri offers by default.

## Technical notes

- Tauri 2 supports multiple webview windows; the Rust state (`AppState`) is
  shared, so per-window repository state must be explicit.
- This ticket is a placeholder to keep the idea tracked; it is not required for
  the M16 exit criteria.

## Implementation notes (2026-09-20)

- `AppState.watchers` is a map keyed by window label (ADR-0008) and
  `pending_repo` holds the repository a new window must open; `on_window_event`
  stops and removes a window's watcher on `Destroyed`.
- `open_repo`/`close_repo` take the calling `WebviewWindow` and use its label;
  `open_repo_in_new_window` creates the window, `initial_repo` hands the path to
  it once on startup.
- Frontend: the tab context menu offers **Open in New Window**; `App` opens the
  pending repository before the session restore.
- Tests: RepoTabs context menu and the `App` new-window startup; the Rust side
  is a thin wrapper over Tauri windows.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (70 files, 519
  tests), `cargo clippy -D warnings`, `cargo fmt --check`.
