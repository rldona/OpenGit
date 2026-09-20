# OG-069 · Repository tabs replacing Recents

- **Milestone:** Next (post-M8)
- **Status:** done
- **Depends on:** OG-002, OG-041
- **References:** docs/architecture/overview.md, `src/App.tsx`, `src/lib/stores/repo.ts`

## Context

Opening a repository shows it in the "Recents" sidebar block, newest first
with the active repo on top. This mixes history with navigation and forces a
sidebar round-trip to switch repositories.

## Scope

- Remove the `Recents` collapsible block from the sidebar.
- Add a tab strip between the header toolbar and the content:
  `Repo 1 | Repo 2 | … | Repo N`, each tab with `title={path}` and a `×`
  close button.
- Hidden with 0–1 open repos; visible with ≥2.
- Session tabs only: tabs hold explicitly opened repos in fixed order
  (append at the end, clicking only highlights the active tab).
- `×` removes the repo from the persisted recents file (current `×`
  semantics) and drops the tab. Closing the active tab opens the left
  neighbor (right fallback); closing the last tab returns to Welcome.
- Reopening an already open repo focuses its tab without duplicating or
  reordering.

## Acceptance criteria

- [x] Sidebar no longer contains a Recents section.
- [x] With one repo open no tab strip is rendered; with two or more the
  strip renders with all open repos and `aria-selected` on the active one.
- [x] Clicking a tab switches repository (full reload via `open_repo`).
- [x] Closing a tab removes it from recents and follows the neighbor rule.
- [x] Tab order never changes on switch; only append on first open.
- [x] `npm run typecheck`, `npm run lint`, `npm test` green.

## Out of scope

- `+` button to open a repo from the strip, overflow menus, keyboard
  shortcuts for tab switching.
- Per-tab cached state (log/status/diff reload on switch).
- Restoring tabs across restarts; drag to reorder.

## Technical notes

- Frontend-only change. Rust `recent_repos.json` stays as history; the tab
  order lives in `useRepoStore.openTabs` and is independent of the Rust
  move-to-front in `recents.add()`.
- New component `src/components/RepoTabs.tsx` (`role="tablist"`/`role="tab"`),
  store fields `openTabs`, `closeTab`, switch via existing `open(path)`.
- Styles in `src/styles/global.css` (`.repo-tabs*`); retire `.recent-*`.
- Remove `"recents"` from `DEFAULT_COLLAPSED` in
  `src/lib/stores/collapse.ts`.

## Implementation notes (2026-09-19)

- Frontend-only change: `useRepoStore` gains `openTabs` (fixed order,
  append on first open), `closeTab` (removes from `recent_repos.json` and
  opens the left neighbor, right fallback; last tab returns to Welcome) and
  `close` now moves to the neighbor tab instead of the empty state when
  other tabs remain. `removeRecent` delegates to `closeTab`.
- New `src/components/RepoTabs.tsx` (`role="tablist"`/`role="tab"`,
  `title={path}` tooltip) rendered in `src/App.tsx` between the toolbar and
  the workspace; hidden with fewer than 2 tabs. The `Recents`
  `CollapsibleSection` is removed and `"recents"` drops out of
  `DEFAULT_COLLAPSED`.
- Styles: `.recent-*` replaced by `.repo-tabs`/`.repo-tab(.active)` in
  `src/styles/global.css`. No Rust changes; `recent_repos.json` stays as
  history.
- Tests: extended `src/lib/stores/repo.test.ts` (append, no-reorder switch,
  neighbor close, last-tab close), new `src/components/RepoTabs.test.tsx`
  and an `App.test.tsx` case (strip only with ≥2 tabs, position between
  toolbar and workspace, no Recents text).
- Verified: `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `npm test` (55 files, 427 tests) green.
