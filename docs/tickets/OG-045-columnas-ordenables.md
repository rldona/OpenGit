# OG-045 · Sortable columns in the commit table

- **Milestone:** M7 — SourceTree parity (phase 2)
- **Status:** done
- **Depends on:** OG-037, OG-044
- **References:** ROADMAP.md, OG-037

## Context

OG-037 left the header (Graph, Description, Commit, Author, Date) but it is decorative: `aria-hidden="true"` and with no interaction (`HistoryView.tsx:188`). Widths are fixed by CSS. SourceTree allows sorting by column and adjusting widths.

## Scope

- Interactive header: click sorts ascending/descending by Description, Commit, Author or Date; visual indicator of the active column.
- Column widths resizable by dragging, persisted.
- Default order: git's topological order (the current one), recoverable with one more click or with "Reset order".

## Acceptance criteria

- [x] Clicking a header sorts and the indicator points out column and direction.
- [x] Widths are adjusted by dragging and survive restart.
- [x] You can return to the original topological order.
- [x] Sorting by a column **does not** break graph alignment (see notes).
- [x] Tests: sorting cycle, reset and width persistence.

## Out of scope

- Adding or removing columns.
- Server/git sorting (`--date-order` and friends).

## Technical notes

- **Main risk:** the graph only makes sense in topological order. When sorting by another column the edges cannot be drawn coherently. **Decision taken:** while there is a column sort, the Graph column (canvas and header) is hidden and Description takes its width; when returning to topological it reappears.
- The header cycle is ascending → descending → topological, so git's order is recovered with one more click (a Reset button was not needed).
- Sorting is done on the already-loaded commits without breaking virtualization or incremental loading (`loadMore` keeps appending in git order and the view reorders).
