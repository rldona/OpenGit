# OG-047 · Graph width by visible range

- **Milestone:** M7 — SourceTree parity (phase 2)
- **Status:** done
- **Depends on:** OG-044
- **References:** ROADMAP.md, OG-004, OG-037

## Context

In a repo with many branches, ~300 px of dead space appear between the graph lines and the commit text. The cause is in `HistoryView.tsx`:

```ts
const laneCount = rows.reduce((max, row) => Math.max(max, row.lane + 1, …), 1);
const graphWidth = laneCount * LANE_WIDTH + GRAPH_PADDING;
```

`laneCount` is the maximum over **all** loaded commits, not over the visible ones, and `graphWidth` is applied as `paddingLeft` to each row. If at some point among the 200 loaded commits there are 27 lanes, all rows are indented 390 px even though only 5 are visible on screen. And it gets worse with each `loadMore`.

## Scope

- Compute the graph width over the **visible range**, not over all rows.
- Maximum width cap: past a number of lanes the graph is clipped instead of pushing the text.
- Prevent the width from bouncing on every scroll: hysteresis or rounding to blocks, so that the text does not move horizontally while navigating.
- `GraphCanvas` must repaint with the effective width and keep row-by-row alignment.

## Acceptance criteria

- [ ] In a repo with many branches there is no dead space between the lanes and the description.
- [ ] When scrolling, commit text does not shift horizontally in a visible way.
- [ ] With more lanes than the cap, the graph is clipped and the text remains readable.
- [ ] `loadMore` does not increase the indentation of already visible rows.
- [ ] Tests: width computed over the range, cap applied and stability on scroll.

## Out of scope

- Changing the lane assignment algorithm.
- Horizontal scrolling of the graph.

## Technical notes

- Hysteresis is the delicate part: recalculating the width on every `updateRange` makes the text tremble. The width should only grow within a scroll session, or round to multiples of N lanes.
- The canvas and the rows share the same origin: any width change has to be applied to both at once or the dots get misaligned.
