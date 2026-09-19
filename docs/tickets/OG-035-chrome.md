# OG-035 · Window chrome

- **Milestone:** M6 — Visual parity with SourceTree
- **Status:** done
- **Depends on:** OG-001, OG-023
- **References:** ROADMAP.md

## Context

The app works but its chassis does not look like SourceTree's: there is no native menu, the toolbar mixes actions and status without icons, the repo path is not shown in the title and a status bar is missing.

## Scope

- **Native menu** (Tauri Menu API, no new plugins):
  - macOS: application menu (About, Quit) + `File`, `Edit`, `View`, `Repository`, `Help`.
  - `File`: Open Repository…, Close Repository.
  - `Edit`: the predefined ones (undo/redo/cut/copy/paste/select all) — needed for the editing shortcuts to work on macOS.
  - `View`: File status, History, Diff, Output, Keyboard shortcuts.
  - `Repository`: Fetch, Pull, Push, Refresh, Close.
  - `Help`: Documentation (opens the repo in the browser).
  - Clicks emit a `menu-action` event with the id; the UI routes them to the same handlers as the shortcuts. **The items carry no accelerator** (except the predefined Edit menu): the keyboard is still handled by `useShortcuts` to avoid duplicate executions.
- **Toolbar** with groups and own SVG icons (no dependencies): repository (Open, Fetch, Pull, Push, Refresh, Close) and views (Output, Shortcuts, Theme).
- **Window title** with the repo path (`/path/to/repo` or `OpenGit` without a repo) via the Window API.
- **Bottom status bar**: current branch and number of changes on the left; core version on the right (moved from the toolbar).

## Acceptance criteria

- [x] The native menu appears on macOS/Linux/Windows and each item fires its action when clicked.
- [x] Edit contains the predefined ones: copy/paste works in text fields.
- [x] The toolbar groups actions and views, with icons and accessible names (the existing tests keep passing).
- [x] The window title shows the path of the open repo and goes back to `OpenGit` when closing it.
- [x] The status bar shows branch, changes and core version.
- [x] Tests for menu routing (event → action), title and status bar.

## Out of scope

- Native accelerators in the menus (web shortcuts already cover the keyboard).
- Customizing the macOS menu beyond About/Quit (services, hide, etc.).
- OS icons or external packs.

## Technical notes

- `menu-action` is emitted from Rust in `setup()` with `app.on_menu_event`; the frontend listens in `lib/bridge/events.ts` with `listen("menu-action")`.
- Routing reuses the handler map already used by `useShortcuts`, so adding an action to the menu does not duplicate logic.
- The title is set with `getCurrentWindow().setTitle(...)` from a wrapper in `lib/bridge/window.ts` (mockable in tests).

## Implementation notes (2026-09-18)

- Rust: `build_menu` in `lib.rs` with File/Edit/View/Repository/Help submenus (plus the app menu on macOS); `on_menu_event` emits `menu-action` with the id. Only Edit carries accelerators (predefined); the rest do not, to avoid stepping on `useShortcuts`.
- Frontend: `subscribeMenuEvents` in `lib/bridge/events.ts`; App routes the event to the same shortcut handlers through a ref; own `Icon` (inline SVG, no dependencies); grouped toolbar (repository + views); status bar with branch, conflicts, changes and core version (moved from the toolbar).
- Window title with the repo path (`lib/bridge/window.ts`).
- Tests: 207 frontend (title, status bar and menu routing) and 120 Rust untouched.
- Closed on 2026-09-18 with green CI (Frontend 34 s, Rust 2m9s) in PR #32.
