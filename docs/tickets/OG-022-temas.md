# OG-022 · Light/dark theme

- **Milestone:** M5 — Polish
- **Status:** done
- **Depends on:** —
- **References:** ROADMAP.md

## Context

The UI was born with a single dark theme. The tokens are centralized in `:root` (`global.css`), but there are leftovers outside tokens: semantic states (warning, error, added, deleted, badge), the graph palette and CodeMirror's `oneDark` theme. There is no selector or persistence.

## Scope (v1)

- Theme preference: **system** (default), **light** and **dark**.
- `system` follows `prefers-color-scheme` and reacts live to OS changes.
- "Theme" selector in the toolbar.
- Persistence in `localStorage` (UI preference, no IPC, so as not to delay the first paint).
- `data-theme` on `<html>` with an inline script in `index.html` to avoid the theme flash on startup.
- Semantic tokens per theme: surfaces, border, text, hover, warning, danger, added/deleted, tag badge, `--accent-fg` and graph selection ring.
- Diff (CodeMirror): `oneDark` in dark and light highlighting (`defaultHighlightStyle`) in light; it is rebuilt when the theme changes.
- `color-scheme` per theme for native scrollbars.

## Acceptance criteria

- [x] Changing the selector applies the theme instantly across the whole UI (including diff and graph) without reloading.
- [x] The preference survives a restart; `system` follows the OS and reacts live.
- [x] No flash of the wrong theme on startup (script before React).
- [x] Tests: system/light/dark resolution, persistence, `matchMedia` listener and selector in App.
- [x] No semantic state uses colors only meant for a dark background; all of them go through a token with a light variant.

## Out of scope

- Custom themes, high contrast or more than one light/dark palette.
- Syncing the preference across machines.
- Changing the native Tauri window theme.

## Technical notes

- `src/lib/theme.ts` (types, `resolveTheme`, persistence, `systemPrefersDark`) + `src/lib/stores/theme.ts` (zustand) + effect in `App` for `data-theme` and `matchMedia` listener.
- New tokens in `global.css`: `--warning-*`, `--danger*`, `--add`, `--del`, `--add-bg`, `--del-bg`, `--tag-annotated`, `--accent-fg`.
- The graph uses its own palette (`layout.ts`); v1 keeps it and adds the selection ring color according to the theme.

## Implementation notes (2026-09-18)

- Backend unchanged: the preference lives in localStorage and an inline script in `index.html` sets `data-theme` before mounting React.
- The 32 hardcoded colors of `global.css` become tokens; `[data-theme="light"]` redefines the palette and `color-scheme`.
- `DiffEditor` chooses `oneDark` or `syntaxHighlighting(defaultHighlightStyle)` and is rebuilt when the theme changes; `GraphCanvas` uses `selectionRingColor`.
- Tests: 147 frontend (12 new for theme, store and selector), 97 Rust untouched.
- Closed on 2026-09-18 with green CI (Frontend 32 s, Rust 1m35s) in PR #18.
