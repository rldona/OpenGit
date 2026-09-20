# OG-037 · Commit table with header

- **Milestone:** M6 — Visual parity with SourceTree
- **Status:** done
- **Depends on:** OG-035, OG-036
- **References:** ROADMAP.md

## Context

The history has no header or columns: the data (hash, author, date) goes in fixed CSS positions without any visual reference, and the graph floats over the list without context.

## Scope

- Fixed header over the list with the columns **Graph · Description · Commit · Author · Date**, aligned with the rows (same gap and padding, dynamic graph width).
- Row columns aligned with the header: `Description` groups ref badges + subject and takes the flexible space; `Commit` (7 characters), `Author` and `Date` with fixed width.
- The graph canvas and the list start **below** the header (24 px offset) so that the rows and the graph remain aligned when scrolling.
- Subject and author with `title` (full text) for when they are truncated with ellipsis.
- No changes in virtualization, incremental scroll or graph layout.

## Acceptance criteria

- [x] The header shows the five columns and does not scroll with the list.
- [x] The cells of each row are aligned with their column and the graph starts at the same height.
- [x] Long texts are truncated with ellipsis and show the full text in `title`.
- [x] The existing history tests keep passing and there are assertions for the header.

## Out of scope

- Sorting by column (the order is defined by git with `--topo-order`).
- Resizing columns by hand.
- Grouping by date or day separators.

## Technical notes

- The header repeats the row structure (gap 10 px, padding-right 12 px) and uses dynamic `paddingLeft` like the rows to match the graph width.
- `.history-list` and `.history-graph` go from `top: 0` to `top: 24px`; the canvas height is still computed by `GraphCanvas` with `clientHeight`.

## Implementation notes (2026-09-18)

- `.commit-header` header with the same gap/padding as the rows and dynamic `paddingLeft` equal to the graph width; `Description` groups refs + subject (the refs column remains fixed at 220 px inside the row).
- The header is `aria-hidden` (it is a visual guide); the rows remain accessible buttons.
- List and canvas move down 24 px so they do not go under the header; virtualization and scroll untouched.
- Subject and author with `title` for the full text.
- Tests: 218 frontend (header assertions in App) and 120 Rust untouched.
- Closed on 2026-09-18 with green CI (Frontend 36 s, Rust 2m7s after rerunning the job due to a flake in the watcher test, noted in `.ai/memory/ci.md`) in PR #34.
