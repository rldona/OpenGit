# OG-077 · Update check with download link

- **Milestone:** Next (post-M8)
- **Status:** done
- **Depends on:** OG-023
- **References:** `src/lib/updates.ts`, `src/lib/stores/update.ts`, `src-tauri/src/lib.rs`

## Context

There is no way to learn about new releases from inside the app. A full
Tauri auto-updater is out of scope (OG-028: no signing infrastructure),
so the app checks the latest GitHub release and offers the download
page, silently on startup plus a manual menu item.

## Scope

- `src/lib/updates.ts`: fetch the latest release tag from the GitHub
  API (timeout, offline-safe silent failure), semver `isNewer`
  comparison, 24h `localStorage` cache, open the releases page.
- `src/lib/bridge/app.ts`: `appVersion()` wrapper over the existing
  `app_version` command.
- `src/lib/stores/update.ts`: `idle|checking|available|up-to-date|error`
  state with `check({ manual })`; automatic checks only surface
  `available`.
- Native `Check for Updates…` item next to About (app menu) and next to
  Documentation (Help menu); `check-updates` routed in `menuDispatch`.
- Dismissible `UpdateNotice` banner in `App` when an update is available;
  manual checks also report "up to date".
- No new dependencies; no Rust changes besides the menu items; no CI
  changes.

## Acceptance criteria

- [x] Starting the app checks once (cached 24h) and only notifies when a
  newer version exists.
- [x] The menu item forces a check and reports the result either way.
- [x] Offline startup stays silent and never blocks the UI.
- [x] `npm run typecheck`, `npm run lint`, `npm test`,
  `cargo clippy --all-targets -- -D warnings` green.

## Out of scope

- Auto-download/install, updater artifacts or signing keys (OG-028).
- Keyboard shortcut for the check.
- Pre-release channels.

## Implementation notes (2026-09-19)

- Pure frontend: `updates.ts` (GitHub API + semver + 24h cache),
  `bridge/app.ts` (`app_version`), `stores/update.ts`, `UpdateNotice`
  banner; only Rust touch is the two menu items (distinct ids to avoid
  submenu id clashes).
- `App.test` stubs `fetch` offline and mocks `bridge/app` so the startup
  check never touches the network.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (58 files,
  456 tests), `clippy --all-targets -D warnings`, `cargo fmt --check`.
