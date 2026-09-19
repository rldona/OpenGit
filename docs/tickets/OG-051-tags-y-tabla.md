# OG-051 · Clickable tags and table borders

- **Milestone:** M7 — SourceTree parity (phase 2)
- **Status:** done
- **Depends on:** OG-045, OG-048
- **References:** ROADMAP.md, OG-038

## Context

Three parity touch-ups detected when comparing with SourceTree:

- Tags did nothing when clicked; in SourceTree they lead to the commit.
- The panel separators were 4px and got tinted when hovering.
- The column handles lived outside their column: being flex items
  only in the header, they shifted it relative to the rows (22px in Commit,
  11px in Author) and dragging accentuated the mismatch.

## Scope

- `Ref` exposes `target` (bare object of `%(*objectname)`): on an annotated tag
  it is the commit, not the tag object.
- Clicking a tag loads log pages until the commit is found (removing the
  branch filter if it gets in the way), selects it and the virtualized list
  scrolls to it.
- Panel separators of 1px with no hover color, with a wide hit area.
- Column handles absolutely positioned over the border of their column.
- The Tags section loses the `+` (creating a tag lives in the context menu) and
  its rows lose the hover Push/Delete buttons.

## Acceptance criteria

- [x] Clicking a tag selects its commit in the history and brings it into view.
- [x] An annotated tag resolves to its commit (parser test with fixture).
- [x] Table header and rows match pixel-perfect in the three columns.
- [x] The separators look like a line and do not change color on hover.

## Out of scope

- Sorting the table by columns (OG-045).
- Showing tags as their own column in the commit row.
