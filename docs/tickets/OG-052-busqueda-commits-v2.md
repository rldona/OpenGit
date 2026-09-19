# OG-052 · Commit search (v2)

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** done
- **Depends on:** OG-018, OG-044
- **References:** ROADMAP.md, OG-018

## Context

OG-018 implemented search by message, author and path in the history toolbar.
The visual parity of M7 removed that UI (it took up space and duplicated
filters), but the `log_page` backend still accepts `LogSearch` and the store was
left without search actions: today you cannot search and SourceTree can.

## Scope

- Search UI in history as a mode, not as three loose fields: message field
  always visible and author/path collapsible; Clear button.
- Result counter and "no results" state when the search returns nothing,
  without confusing it with "empty repo".
- `mod+f` shortcut to focus the search (it was removed with the UI; it comes back).
- The branch filter and the search combine.
- With an active search the layout is flattened (parents outside the result do
  not draw edges), as OG-018 already did.

## Acceptance criteria

- [x] Searching by message filters the log and shows the number of results.
- [x] Author and path filter the same way and can be combined with each other and with the branch.
- [x] Clear returns to the full log without losing the branch filter.
- [x] `mod+f` focuses the search field.
- [x] Synthetic repo of 10,000 commits: the search resolves without blocking
      the UI and without reloading more than one page.
- [x] Store and UI tests with the mocked bridge.

## Out of scope

- Regular expressions or `git grep` over content.
- Recent search history.
- Searching inside a diff.

## Technical notes

- Reintroduce `applySearch`/`clearSearch` in `useLogStore` on top of the `search`
  that `logPage(path, skip, take, rev, search)` already knows.
- `Ctrl+F` no longer exists in `SHORTCUTS`: restore the entry and the focus.
- Keep virtualization: the search reloads from page 0.

## Implementation notes (2026-09-19)

- The Rust backend already accepted `LogSearch` (`--fixed-strings
  --regexp-ignore-case --grep/--author` and `-- <path>`): no changes there.
- `useLogStore` gains `search`, `applySearch` and `clearSearch`. The search
  travels through `load`, `reload` and `loadMore`, so the watcher refresh and
  pagination keep it active; an all-empty search normalizes to `null`. In search
  mode the graph inputs drop `parents`, which paints the results in a single
  column with no dangling edges (same flattening as OG-018).
- The history toolbar has a message field always visible and author/path behind
  a Filters toggle, a Search/Clear pair and a `N[+] results` counter. With no
  matches it shows "No commits match the search" instead of the empty-repo
  state.
- `mod+f` is back in `SHORTCUTS` (id `search`). The App switches to History and
  bumps `searchFocusRequest` in the UI store; `HistoryView` focuses the field.
- Tests: store (apply/empty/combine/clear/paginate/flatten) and App
  (search+count+clear, `mod+f` focus, no-results state).

