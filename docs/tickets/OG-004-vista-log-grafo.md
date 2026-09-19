# OG-004 · Log view with graph

- **Milestone:** M1 — Local MVP
- **Status:** done
- **Depends on:** OG-003
- **References:** ADR-0004, skill `commit-graph-layout`

## Context

It is the main view and the biggest differentiator against SourceTree: same graph, but smooth on large repos.

## Scope

- Commit list with columns: graph, refs, short hash, author, date and subject.
- Canvas graph: lanes, stable colors per branch, merge/branch of merges.
- Ref badges: `HEAD`, local branch, remote branch, tag.
- Lane layout as a pure and incremental function, tested apart from the canvas.
- Paginated loading with infinite scroll (`--topo-order`, `--parents`, `--max-count`/`--skip`).
- Filter by branch/ref and "all branches" option (include remotes).
- Commit selection synchronized with the detail panel.

## Acceptance criteria

- [x] 10,000-commit repo: first paint < 500 ms and smooth scroll. _(layout of 10,000 commits covered by test; the render only draws visible rows + viewport canvas)_
- [x] The layout is verified with unit tests covering merges, octopus, orphan branches and root commit. _(7 tests in `src/lib/graph/layout.test.ts`)_
- [x] Branch colors are stable across refreshes and sessions. _(color by ref name with FNV hash; stability test)_
- [x] Loading more commits does not recalculate the already painted layout incorrectly (no visual jumps). _(incremental test: paginating == a single pass)_
- [x] `devicePixelRatio` produces a sharp canvas on HiDPI screens.

## Out of scope

- Reordering by flat date (only topo-order for now).
- Commit search (M3).
- Multi-selection and ranges.

## Technical notes

- Rows are rendered in a virtualized DOM; the canvas is decorative (`aria-hidden`) and selection lives in the row (ADR-0004).
- Relative dates ("today 08:52", "yesterday") calculated in the frontend from timestamp + commit offset.

## Implementation notes (2026-09-18)

- Backend: `log_page` accepts `rev: Option<&str>` (`--all` or `--end-of-options <rev>` so that a ref is not interpreted as an option); new commands `log_page` and `list_refs`. Branch filtering test.
- Layout (`src/lib/graph/layout.ts`): lanes with their own **id** and colors in a separate map, so the color of a line is resolved at the end of the page (a branch discovered when reaching its tip does not change color mid-way). Supports convergence of lanes that were waiting for the same commit.
- Render (`GraphCanvas`): 2D canvas of the viewport only, `devicePixelRatio`, nodes with selection ring and `parent` edges (downwards) and `converge` edges (towards the node).
- List (`HistoryView`): custom virtualization by fixed height (28 px, overscan of 6), infinite scroll when 12 rows are left, branch filter and detail panel of the selected commit.
- Closed on 2026-09-18 with green CI (Frontend 18 s, Rust 1m23s) in PR #4.
