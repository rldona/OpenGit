# OG-088 · Open a repository in a new window

- **Milestone:** M16 — Repository lifecycle (optional)
- **Status:** backlog
- **Depends on:** OG-069
- **References:** `src-tauri/tauri.conf.json`, `src/lib/stores/repo.ts`

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

- [ ] The chosen model is recorded in an ADR before implementing.
- [ ] Opening a repository in a new window shows its history and status there.
- [ ] Closing the window does not disturb the main window's tabs.
- [ ] The watcher and auto-refresh behave per window.
- [ ] Checks green.

## Out of scope

- Multiple windows before the ADR is accepted.
- Window layout/size persistence beyond what Tauri offers by default.

## Technical notes

- Tauri 2 supports multiple webview windows; the Rust state (`AppState`) is
  shared, so per-window repository state must be explicit.
- This ticket is a placeholder to keep the idea tracked; it is not required for
  the M16 exit criteria.
