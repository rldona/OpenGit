# OG-036 · Resizable splits

- **Milestone:** M6 — Visual parity with SourceTree
- **Status:** done
- **Depends on:** OG-035
- **References:** ROADMAP.md

## Context

The panels have fixed widths/heights (sidebar 240 px, diff list 280 px, output of variable height). In SourceTree every split is dragged and the size is preserved.

## Scope

- Reusable `SplitPane` component:
  - horizontal (columns) or vertical (rows), with the fixed panel at the start or the end;
  - draggable divider with pointer events, minimum/maximum and `role="separator"` with `aria-valuenow`;
  - keyboard resizing with the arrows (±10 px, with Shift ±40);
  - collapsed state (no divider) for panels that are hidden.
- Size persistence by key in `localStorage` (`opengit.layout.*`), with pure helpers in `lib/layout.ts`.
- Applied to:
  - sidebar ↔ content (`opengit.layout.sidebar`);
  - output ↔ rest of the window (`opengit.layout.output`, vertical, at the end, collapsible);
  - file list ↔ diff (`opengit.layout.diff-files`);
  - commit list ↔ commit detail (`opengit.layout.history-detail`, collapsible when there is no selection).

## Acceptance criteria

- [x] Dragging each divider resizes the corresponding panel within its limits.
- [x] The divider arrows adjust the size when focused.
- [x] The sizes survive a remount of the view (localStorage) and corrupt values fall back to the default size.
- [x] Collapsible panels do not show a divider when hidden.
- [x] Tests: layout helpers, component (keyboard and persistence) and rendering of the four integrations.

## Out of scope

- Double click to reset to the default size and snap to predefined positions.
- Nested splits configurable by the user or saveable layouts.
- Resizing internal columns of the commit table (arrives with OG-037).

## Technical notes

- The size lives in a `useState` initialized from `localStorage`; the drag listens to `pointermove`/`pointerup` on `window` to avoid losing the gesture when leaving the divider.
- `SplitPane` does not impose the outer layout: each integration passes its `className` (`panes`, `diff-body`, `history-body`) to inherit the existing `flex`.
- The fixed CSS widths (`.sidebar`, `.diff-files`) become default sizes of the component.

## Implementation notes (2026-09-18)

- `lib/layout.ts`: `LAYOUT_KEYS`, `clampSize`, `loadSize` and `saveSize` (corrupt or out-of-range values fall back or are clamped).
- `SplitPane`: divider with pointer events (listens on `window` to avoid losing the gesture), keyboard ±10/±40, `role="separator"` with `aria-*`, and collapsed mode without a divider.
- Integrations: sidebar↔content and output (vertical, collapsible when hiding Output) in App; list↔diff in DiffView; list↔detail in HistoryView (collapsed without selection). The fixed widths of `.sidebar`, `.diff-files` and `.commit-detail` were removed.
- Tests: 218 frontend (4 layout and 7 SplitPane) and 120 Rust untouched.
- Closed on 2026-09-18 with green CI (Frontend 37 s, Rust 2m7s) in PR #33.
