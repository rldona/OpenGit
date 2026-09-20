# ADR-0008 · A window per repository

- **Status:** accepted
- **Date:** 2026-09-20
- **Deciders:** Raúl López

## Context

Repositories live in session tabs inside one window (OG-069). For side-by-side
work, SourceTree lets a repository be opened in its own window. Tauri 2 can
create several webview windows, but they share the same Rust `AppState`, and
until now the state held a single watcher (`Option<WatcherHandle>`), so opening
a repository in a second window would have stopped the first window's watcher.

## Decision

Each window is an **independent React instance with its own stores**. A new
window learns which repository to open through a **pending map keyed by window
label**: `open_repo_in_new_window` stores the path and creates the window; the
new window asks `initial_repo` on startup and opens it. The Rust side keeps one
**watcher per window label** and removes it when the window is destroyed.

## Alternatives considered

- **A URL query parameter (`?repo=…`)** — needs percent-encoding and behaves
  differently between the dev server and the bundled app. The pending map
  avoids both.
- **Sharing the tab list across windows** — requires cross-window state
  synchronisation for tabs, selection and watchers; much more complexity for
  little gain.
- **Split panes inside one window** — a different feature; it does not give real
  OS windows.

## Consequences

- Closing a window does not disturb the others: each has its own tabs, stores
  and watcher.
- The watcher registry is keyed by window label and must be cleaned on
  `WindowEvent::Destroyed`, or it would leak.
- Repository events stay global (`app.emit`) but the UI already ignores events
  whose root is not the open one (OG-010), so windows do not cross-refresh.
- `auto_refresh` remains a single global flag.
- Opening the same repository in two windows is allowed; each watches it.
