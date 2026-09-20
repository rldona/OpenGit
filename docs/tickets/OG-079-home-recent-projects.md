# OG-079 · Home screen with recent projects

- **Milestone:** Next (post-M8)
- **Status:** done
- **Depends on:** OG-002, OG-069
- **References:** `src/App.tsx`, `src/lib/stores/repo.ts`, `src-tauri/src/repo/recents.rs`

## Context

The Welcome empty state (`Welcome` in `src/App.tsx:445`) only offers a
"Choose folder" button. Recent repositories are already persisted in
`app_data_dir()/recent_repos.json` and loaded into the store
(`recents`, `loadRecents`, `recentRepos`), but since OG-069 removed the
Recents sidebar block they are no longer rendered anywhere: the user has
to go through the native picker every time. The goal is to surface them
on the home screen as a direct shortcut, newest first.

## Scope

- Render a "Recent Projects" list inside `Welcome` (shown only when
  `recents` is non-empty), each item showing the project `name` as the
  title and its `path` below, `title={path}` on hover.
- Clicking an item opens that repository through the existing
  `open(path)` flow.
- Provide an explicit remove control per item that deletes it from the
  persisted recents (`removeRecentRepo`) without opening or closing any
  repository.
- Keep the existing cap of `MAX_RECENTS = 10` (already enforced in
  `recents.rs`); the UI renders whatever the core returns.
- Keep the "Choose folder…" button (native dialog) as the primary action.

## Acceptance criteria

- [x] With no repo open and persisted recents, the home lists the
  projects newest first with name and path.
- [x] With no recents, the list is not rendered (current empty state
  stays).
- [x] Clicking a recent opens it (same result as `pickAndOpen` for that
  path) and the loading guard still prevents double opens.
- [x] Removing an item drops it from the list and from
  `recent_repos.json`, and does not close the active repo nor remove an
  open tab.
- [x] At most 10 items are shown.
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `npm test` green.

## Out of scope

- The bottom file browser from the reference mock-up (breadcrumbs, `Go`,
  filter, show hidden). Home uses the existing native directory dialog.
- Free-text search/filter of recents, pinning, manual reordering
  (recents stay ordered by `opened_at`, move-to-front).
- Restoring open tabs across restarts.

## Technical notes

- Frontend-only change; no Rust changes and no new dependencies. Recents
  already flow through `recent_repos` / `remove_recent_repo`.
- Semantic conflict to resolve: OG-069 tied `closeTab` to deleting the
  path from the recents file (`closeTab` calls `removeRecentRepo`) and
  `removeRecent` merely delegates to `closeTab`. With recents visible
  again, closing the last tab would erase the project from the home.
  Split the two concerns: closing a tab must not touch history, and
  removing from recents must not affect tabs. Update
  `src/lib/stores/repo.ts` and its tests accordingly.
- New component `src/components/RecentProjects.tsx` (list with
  `role="list"`/`role="listitem"`), rendered by `Welcome`; call
  `useRepoStore` for `recents`, `open` and the new remove action.
- Styles under `.welcome-*` / `.recent-project*` in
  `src/styles/global.css`, alongside `.empty-state`.
- The path can be shortened for display (e.g. `~` for the home dir)
  but the full path stays in `title` and in `recent_repos.json`.
- Tests: `src/components/RecentProjects.test.tsx` (render, click opens,
  remove) plus an `App.test.tsx` case for the empty state with and
  without recents; extend `src/lib/stores/repo.test.ts` for the
  close-tab/remove split.

## Implementation notes (2026-09-20)

- Frontend-only change; no Rust changes and no new dependencies. Recents
  already arrive from `recent_repos` / `remove_recent_repo`.
- New `src/components/RecentProjects.tsx` (`<section
  aria-label="Recent projects">`, list of name/path buttons plus a
  per-item remove button), rendered inside `Welcome` in `src/App.tsx`.
  Hidden when `recents` is empty.
- Semantic split in `src/lib/stores/repo.ts`: `closeTab` no longer calls
  `removeRecentRepo` and only touches the session, while `removeRecent`
  deletes from `recent_repos.json` and filters the in-memory list
  without touching `repo` or `openTabs`. This keeps a closed project
  available on the home screen.
- Styles `.welcome-*` added in `src/styles/global.css`, scoped with
  `.empty-state .welcome-recent-*` to override the generic
  `.empty-state button` rules.
- Tests: new `src/components/RecentProjects.test.tsx`; extended
  `src/lib/stores/repo.test.ts` (close keeps history, remove is
  history-only) and `src/App.test.tsx` (home lists recents and opens
  one). Verified: `npm run typecheck`, `npm run lint`,
  `npm run format:check`, `npm test` (60 files, 469 tests) green.
