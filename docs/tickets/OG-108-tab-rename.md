# OG-108 · Rename repository tabs inline

- **Milestone:** —
- **Status:** ready
- **Depends on:** OG-069, OG-082, OG-107
- **References:** OG-070, `src/components/RepoTabs.tsx`, `src/lib/tabs.ts`, `src/lib/stores/repo.ts`, `src/styles/global.css`

## Context

Tabs show the repository folder name (OG-069) and can be reordered (OG-107),
but their label is fixed. Repositories with generic or duplicated folder names
cannot be told apart, so there is no way to keep a meaningful name on a tab.

## Scope

- Second context-menu item "Rename the tab", next to "Open in New Window".
- Selecting it swaps the tab button for an inline text input, prefilled with
  the current label and with its text selected.
- Enter commits, Escape cancels and blur commits.
- An empty (or whitespace-only) value resets the tab to the folder name.
- The custom name is kept in the session (`opengit.openTabs`) when the
  `restoreTabs` preference is on; with the preference off the rename stays in
  memory only.
- Session schema migrates from `{ paths, active }` to
  `{ tabs: [{ path, title? }], active }`, backward-compatible: the legacy shape
  still loads and is normalized on read.

## Acceptance criteria

- [ ] The tab context menu offers "Rename the tab" for every tab.
- [ ] Choosing it renders an inline input prefilled with the current label and
      with the text selected.
- [ ] Enter and blur commit the rename; Escape cancels without committing.
- [ ] An empty rename resets the label to the repository folder name.
- [ ] A custom label renders instead of the folder name and survives a tab
      switch and a reopen.
- [ ] With `restoreTabs` on the custom label is persisted and restored; with it
      off nothing is written and the stored session stays absent.

## Out of scope

- Renaming the repository on disk or editing `recent_repos.json`.
- Overflow menus and per-tab state cache.
- Several renames open at once.

## Technical notes

- Frontend-only change: `Tab` gains an optional `title` (`src/lib/tabs.ts`) and
  `useRepoStore` gains a synchronous `renameTab(path, title)` next to
  `moveTab`, reusing `persistSession`.
- `StoredSession` becomes `{ tabs: StoredTab[]; active: string | null }` with
  `StoredTab = { path; title? }`; `loadStoredSession` normalizes the legacy
  `{ paths, active }` shape so existing sessions keep loading.
- `RepoTabs` swaps the `.repo-tab-open` button for a `.repo-tab-input` while
  editing; the drag starts from the button, which is not rendered while
  editing, so the input never drags.
- Styles for `.repo-tab-input` live in `src/styles/global.css` next to the tab
  rules. The input sizes to its content (`field-sizing: content`) so the tab
  footprint does not jump when the rename starts or is cancelled.
