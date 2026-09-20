# OG-070 · Tab strip plus button and switching shortcuts

- **Milestone:** Next (post-M8)
- **Status:** done
- **Depends on:** OG-069
- **References:** `src/lib/shortcuts.ts`, `src/components/RepoTabs.tsx`, `src/lib/stores/repo.ts`

## Context

OG-069 hides the tab strip with a single repo, and the toolbar has no Open
button while a repo is open: opening a second repository requires the native
menu. There is also no keyboard way to move between tabs (`mod+1/2/3` switch
views, not tabs).

## Scope

- Show the tab strip whenever at least one repo is open, with a `+` button
  at the end that opens the folder picker (`pickAndOpen`, same as `mod+o`).
- Keep the strip hidden with no repo open (Welcome owns the empty state).
- Add `mod+shift+[` / `mod+shift+]` for previous/next tab, cyclical
  (wrap around at the ends), no-op with fewer than two tabs.
- Extend the shortcut matcher to support `shift` in definitions without
  changing existing shortcuts; show the new shortcuts in the help dialog.
- No close-tab shortcut (`mod+w` would close the window in Tauri).

## Acceptance criteria

- [x] With one repo open the strip shows the single tab plus `+`; with none
  it renders nothing.
- [x] Clicking `+` launches the native folder picker.
- [x] `mod+shift+[` / `mod+shift+]` switch tabs cyclically; existing
  shortcuts (`mod+o`, `mod+1/2/3`, `?`, …) behave as before.
- [x] The shortcuts help dialog lists the two new shortcuts with correct
  per-platform labels.
- [x] `npm run typecheck`, `npm run lint`, `npm test` green.

## Out of scope

- Close-tab shortcut, overflow menus, drag to reorder, per-tab state cache.

## Technical notes

- `parseKeys`/`matchesShortcut` gain an optional `shift` token: definitions
  with `shift` require `event.shiftKey`; definitions without it keep
  ignoring Shift (backwards compatible, `?` exempt as today).
- New store action `switchTab(dir: 1 | -1)`, wired in `App.tsx` actions via
  the existing `useShortcuts` hook.
- Known layout risk: on Spanish keyboards `[`/`]` may need AltGr/Option,
  which the matcher rejects (`altKey`); validate in dev and fall back to
  `mod+PageUp`/`mod+PageDown` if dead.

## Implementation notes (2026-09-19)

- `src/lib/shortcuts.ts`: `ShortcutId` gains `prevTab`/`nextTab`
  (`mod+shift+[`/`mod+shift+]`, group Navigation, auto-listed in the help
  dialog). `parseKeys` returns `shift`; `matchesShortcut` requires
  `event.shiftKey` only for definitions with `shift`; `formatKeys` renders
  `⌘⇧[` / `Ctrl+Shift+[`.
- `useRepoStore.switchTab` moves cyclically with wrap-around, no-op under
  two tabs; `App.tsx` wires both shortcuts through `useShortcuts`.
- `RepoTabs` renders with ≥1 tab plus a `+` button (`pickAndOpen`);
  `.repo-tab-add` style in `global.css`.
- Tests: matcher/format shift cases, cyclical `switchTab`, `+` button,
  App keyboard switching via `fireEvent`.
- Verified: `typecheck`, `lint`, `format:check`, full `npm test`
  green. Physical Spanish-layout validation of `[`/`]` pending by the user
  in dev (HMR already applied).
