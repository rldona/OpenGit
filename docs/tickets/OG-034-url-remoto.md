# OG-034 · Open the remote URL

- **Milestone:** M5 — Polish
- **Status:** done
- **Depends on:** OG-008
- **References:** ROADMAP.md

## Context

The app shows remote branches but not the remote URL, and the roadmap allows as the only hosting extra "open the remote URL". Today you have to copy it from the terminal.

## Scope

- Backend: `remote_urls` lists the remotes with `git remote` + `git remote get-url <name>` and computes a web URL when possible.
  - Pure conversion `remote_web_url`: `https://`, `http://`, `ssh://`, `git://` and scp format (`git@host:org/repo.git`) → `https://host/org/repo`; local paths and `file://` are not openable.
- UI: **↗** button next to each remote name in the refs sidebar when its web URL exists; opens the system browser.
- Opening with `tauri-plugin-opener` (new dependency justified: Tauri 2 does not expose opening external URLs without a plugin) and capability permission limited to `http://` and `https://`.
- The remotes are loaded in the `extras` store along with the rest of the repo metadata.

## Acceptance criteria

- [x] `remote_web_url` converts https/scp/ssh/git and rejects local paths and `file://`.
- [x] `remote_urls` lists name, URL and web URL of each remote in the repo.
- [x] The sidebar shows the button only for remotes with a web URL and calls the opener with that URL.
- [x] The capability limits opening to `http`/`https`.
- [x] Tests: conversion unit, `remote_urls` integration, store and sidebar.

## Out of scope

- Cloning, adding or editing remotes.
- Opening local files or `file://` paths (restricted to http/https).
- Hosting integrations (PRs, issues).

## Technical notes

- **New dependency justified:** `tauri-plugin-opener` (crate 2 and `@tauri-apps/plugin-opener`) is the official Tauri 2 way to open URLs in the system browser; it avoids `window.open`, which would open a WebView window.
- The permission goes with an explicit scope: `{ "identifier": "opener:allow-open-url", "allow": [{ "url": "https://*" }, { "url": "http://*" }] }`.
- The conversion does not validate that the host exists; it only normalizes the text. Remotes without a web URL simply do not show a button.

## Implementation notes (2026-09-18)

- Rust: `remote_web_url` (https, ssh with port, scp, git://; rejects local paths, Windows drives and `file://`) and `remote_urls` with `git remote` + `get-url` per name; command registered.
- Plugin `tauri-plugin-opener` (crate and npm) with capability scope to http/https; finding noted in `.ai/memory/tauri.md`.
- UI: `RefsSidebar` reads the remotes from the `extras` store and renders **↗** per remote with a web URL; the rest show no button.
- Tests: 120 Rust (3 new) and 204 frontend (2 in the sidebar).
- Closed on 2026-09-18 with green CI (Frontend 39 s, Rust 3m56s; includes compiling the new plugin) in PR #31.
