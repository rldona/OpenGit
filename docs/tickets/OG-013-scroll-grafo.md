# OG-013 · Smooth graph scrolling (no flicker)

- **Milestone:** M1 — Local MVP
- **Status:** done
- **Depends on:** OG-004
- **References:** ADR-0004, .ai/memory/performance.md

## Context

When scrolling fast in the history, the graph flickers and jumps relative to the rows. The canvas moved with `style.top = scrollTop` and was redrawn in a `useEffect` (after paint), also reassigning the buffer (`canvas.width`) on every scroll event. SourceTree does not present this problem.

## Scope

- Canvas as a fixed layer (overlay) inside the list container, without repositioning it with the scroll.
- Redraw synchronized with the scroll via `requestAnimationFrame` (coalesced), before paint.
- Reassign the canvas buffer only when size or `devicePixelRatio` changes.
- Update the rows DOM only when crossing row boundaries (not on every scroll pixel).

## Acceptance criteria

- [ ] Fast scrolling without flicker or desync between the graph and the rows.
- [ ] No React renders per scroll event (only when the visible window changes).
- [ ] No canvas buffer reassignment per frame.

## Out of scope

- Changing the layout algorithm (OG-004) or the render engine (canvas).

## Technical notes

- Pure function `visibleRange(scrollTop, viewportHeight, rowCount, overscan)` with tests.
- The canvas becomes a child of a `position: relative` container and the scrollable list is overlaid with `z-index: 1`.

## Implementation notes (2026-09-18)

- `GraphCanvas` no longer receives `scrollTop`/`viewportHeight`: it observes the scroller (passive `scroll` + `ResizeObserver`), reads `scrollTop` at draw time and repaints on the next `requestAnimationFrame`.
- The buffer is resized only if the size or the DPR changes; the rest of the frames only change `ctx` and paint visible rows.
- `HistoryView` computes the visible window with `visibleRange` and only updates state when crossing a row; rows are positioned at `index * ROW_HEIGHT` (no per-pixel arithmetic).
- Closed on 2026-09-18 with green CI (Frontend 28 s, Rust 2m9s) in PR #7.
