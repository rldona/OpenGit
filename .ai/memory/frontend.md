# Frontend

## The canvas does not inherit CSS variables

- **Date:** 2026-09-18
- **Context:** light/dark theme (OG-022); the graph's selection ring was painted with a fixed `#ffffff`.
- **Finding:** `GraphCanvas` draws with the 2D API and its context doesn't resolve `var(--…)`; any themed color must arrive in JS. Reading it with `getComputedStyle` on every scroll frame is unnecessary.
- **Implication:** canvas colors live in JS helpers (`selectionRingColor` in `lib/theme.ts`); if they grow, centralize them there and don't read the DOM in `draw()`.

## CodeMirror: `oneDark` includes highlighting; the light theme needs `defaultHighlightStyle`

- **Date:** 2026-09-18
- **Context:** the diff used a fixed `oneDark` (OG-006) and was unreadable in the light theme.
- **Finding:** `oneDark` provides the theme and the highlight style; without it there are no syntax colors. For the light theme, `syntaxHighlighting(defaultHighlightStyle)` from `@codemirror/language` is enough. The editor is rebuilt on theme change by including it in the effect's deps.
- **Implication:** any CodeMirror extension that depends on the theme must go into the deps of the effect that creates the view.

## UI preferences in localStorage with an anti-flash inline script

- **Date:** 2026-09-18
- **Context:** persisting the theme without IPC and without seeing a dark frame before React mounts.
- **Finding:** in Tauri the WebView persists localStorage per origin (in dev, `http://localhost:1420`). An inline script in `index.html` can read the key and set `data-theme` before the bundle loads; the zustand store reads the same value when it initializes.
- **Implication:** UI preferences go to localStorage; shared state with the core (recents) stays in `app_data_dir`. Keep both scripts in sync (`THEME_STORAGE_KEY`).

## Custom pointer drag instead of native DnD in the WebView

- **Date:** 2026-09-19
- **Context:** OG-060, dragging a branch to merge and files between staged/unstaged.
- **Finding:** HTML5 drag & drop is inconsistent inside the Tauri WebView. The gesture is rebuilt with Pointer Events: `pointerdown` records the origin, a move beyond a 5 px threshold starts the drag, `document.elementFromPoint(x, y).closest("[data-drop]")` resolves the target, and `Escape`/`pointercancel` abort. The active payload lives in `useDragStore` only so the target can highlight itself.
- **Implication:** every drop zone needs `data-drop="<id>"`; tests stub `document.elementFromPoint` because jsdom has no hit testing (PointerEvent itself does work with `fireEvent.pointer*`).
