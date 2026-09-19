# ADR-0004 · Canvas commit graph with incremental loading

- **Status:** accepted
- **Date:** 2026-09-18
- **Deciders:** Raúl López

## Context

The graph view is SourceTree's hallmark and its weakest point in large
repositories. One SVG/DOM node per commit and per segment does not scale: from a
few thousand commits on, scrolling degrades and layout blocks the main thread.

## Decision

Render **lanes and connections on 2D `<canvas>`** with the commit rows
virtualized in DOM. History is loaded in pages (`git log --topo-order` with
`--max-count`/`--skip`) and the lane layout is computed incrementally on the
fly.

## Alternatives considered

- **SVG/DOM per commit** — selection, hit testing and accessibility for free,
  but a node cost that is unacceptable with 10,000+ commits.
- **WebGL** — plenty of capacity, but unnecessary complexity for 10,000–100,000
  segments.

## Consequences

- Smooth scrolling with long history; only the viewport (+ margin) is drawn.
- Hit testing, hover and selection are implemented by hand on top of the
  computed layout (commit ↔ x/y coordinates).
- Accessibility is guaranteed by the virtualized DOM list: the canvas is
  decorative (`aria-hidden`) and selection lives in the rows.
- The layout must be a pure, testable function (`commits -> lanes`),
  independent from the canvas, so it can be covered with unit tests.
- Careful with `devicePixelRatio` (crisp canvas on HiDPI screens) and with lane
  colours in the light/dark theme.
