# OG-082 · Remember open repositories between sessions

- **Milestone:** M15 — Remember open tabs
- **Status:** done
- **Depends on:** OG-069, OG-067
- **References:** `src/lib/tabs.ts`, `src/lib/stores/repo.ts`, `src/lib/stores/settings.ts`, `src/components/SettingsWindow.tsx`

## Context

Tabs are session-only (OG-069): closing the app loses them and the next launch
starts on the home screen. Users who always work on the same repositories would
rather get them back, but not everyone wants that, so it is an opt-in
preference.

## Scope

- New `restoreTabs` preference (default off), persisted in `localStorage` like
  the other UI preferences.
- While it is on, persist the open tabs and the active one; clear the stored
  session when the preference is turned off or the last tab is closed.
- On startup, restore the stored tabs in order and leave the previously active
  repository selected; paths that no longer open are skipped without blocking
  the rest.
- Settings: a "General" tab with the checkbox, applied on OK like the theme and
  automatic refresh.
- Pure `src/lib/tabs.ts` (load/save/clear) with unit tests.

## Acceptance criteria

- [x] With the preference off, launch behavior is unchanged (home screen, no
  writes to the session storage).
- [x] With it on, closing and reopening OpenGit reopens the same tabs in the
  same order with the same active repository.
- [x] Turning the preference off clears the stored session; closing every tab
  also clears it.
- [x] A stored repository that cannot be opened is skipped without blocking the
  rest (`open` catches per path and continues).
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`
  and the Rust checks green.

## Out of scope

- Restoring window size/position or the panel layout.
- Per-repository preferences.
- Restoring the selected view or commit.

## Technical notes

- Persistence is `localStorage` only (no Rust changes), matching OG-067.
- The repo store persists on `open`/`closeTab`/`close` only when the preference
  is on, so the default path never touches the session storage.

## Implementation notes (2026-09-20)

- `src/lib/tabs.ts`: pure `loadStoredSession`/`saveStoredSession`/
  `clearStoredSession`/`syncStoredSession` over `localStorage`
  (`opengit.openTabs`), tolerant of malformed data.
- `settings` store: `restoreTabs` (default off) persisted in
  `opengit.restoreTabs`.
- `repo` store: persists on `open`/`closeTab`/`close` only when the preference
  is on; `restoreSession(paths, active)` reopens in order and selects the active
  one last; closing the last tab clears the session.
- `App` restores the stored session once on mount when the preference is on.
- Settings: new always-available **General** tab with the checkbox, applied on
  OK like the theme and automatic refresh.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (62 files, 489
  tests), `cargo clippy --all-targets -D warnings`, `cargo fmt --check`.
