# OG-107 · Reorder repository tabs by drag & drop

- **Milestone:** —
- **Status:** done
- **Depends on:** OG-060, OG-069
- **References:** OG-070, OG-082, `src/components/RepoTabs.tsx`, `src/lib/hooks/useDragSource.ts`, `src/lib/stores/drag.ts`, `src/lib/stores/repo.ts`

## Context

Tabs keep a fixed order (OG-069, OG-070): they append on first open and only
switch on click or `mod+shift+[` / `mod+shift+]`. There is no way to arrange
them, so repositories used together cannot be kept side by side. The custom
pointer drag built in OG-060 already handles branch and file drops; the tab
strip is the natural next surface for it.

## Scope

- Drag a tab onto another tab to reorder the strip.
- Drop semantics: dropping the dragged tab onto tab X moves it to X's original
  index (`arrayMove`-on-tab); no insertion-gap DOM.
- Visual feedback while dragging: the dragged tab dims and the hovered drop
  target highlights, reusing the OG-060 `.drop-target` treatment.
- Cancel with Escape; a plain click still switches tabs.
- The `+` button is not a drop target.

## Acceptance criteria

- [x] Dragging a tab and dropping it onto another reorders the strip and the
      active repository stays selected.
- [x] Dropping a tab onto itself or outside any tab leaves the order untouched.
- [x] The order persists through `restoreTabs` (OG-082) without changing the
      stored active repository.
- [x] The close button never starts a drag; the `+` button is not a drop target.
- [x] The existing `mod+shift+[` / `mod+shift+]` shortcuts and click-to-switch
      behave as before.
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` and
      `npm test` green.

## Out of scope

- Keyboard reorder shortcut.
- Insertion-gap / placeholder DOM between tabs.
- Dragging tabs between windows, overflow menus, per-tab state cache.

## Technical notes

- Frontend-only change: extend `DragPayload` with `{ kind: "tab"; path: string }`
  and add a synchronous `moveTab(fromPath, toPath)` to `useRepoStore`, next to
  `closeTab`/`switchTab`.
- `moveTab` reads and writes `openTabs` only; it reuses `persistSession`, which
  already writes only when `restoreTabs` is on.
- `RepoTabs` reuses `useDragSource` (OG-060). Each `.repo-tab` carries
  `data-drop={`tab:${path}`}` and the drag starts from the `.repo-tab-open`
  button, never from the close button.
- Styles for `.repo-tab.dragging` / `.repo-tab.drop-target` and the
  `grab`/`grabbing` cursor live in `src/styles/global.css`, next to the tab
  rules.
