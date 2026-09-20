# OG-018 · Commit search

- **Milestone:** M3 — Advanced history
- **Status:** done
- **Depends on:** OG-004
- **References:** ROADMAP.md

## Context

With long histories, finding a commit by its message, its author or the files it touched is essential. The graph already has a branch filter; search is missing.

## Scope

- Search by text in the message (`--grep`), by author (`--author`) and by file path (`-- <path>`).
- The three filters combine (intersection) and coexist with the existing branch filter.
- Literal search (no regex) so metacharacters do not surprise, ignoring case.
- Pagination and infinite scroll over the results.
- Button to clear the search and return to the full history.
- In search mode the list is shown without lanes (the parents are not in the results): nodes in a single column.

## Acceptance criteria

- [x] Searching by message returns only the commits containing it (literal, case-insensitive). _(test with metacharacters)_
- [x] Searching by author filters by name or email. _(test)_
- [x] Searching by file returns the commits that touched that path. _(test)_
- [x] The filters combine and can be cleared. _(tests + Clear button)_
- [x] Results paginate and the watcher refresh keeps the search active. _(pagination test; the store reload reapplies the search)_

## Out of scope

- Search inside diff content (`-S`/`-G`).
- Search on the remote.
- Search history.

## Technical notes

- `git log --fixed-strings --regexp-ignore-case --grep=<text> --author=<text> -- <path>`, always with `-z` and separator `--format`.
- User text goes as an argument (never through a shell); the path goes after `--`.
- In search mode the layout uses `parents: []` so it does not leave open lanes that never close.

## Implementation notes (2026-09-18)

- Rust: `LogSearch { grep, author, path }` and extended `log_page`; the `log_page` command accepts `search`. Tests of literal grep (with metacharacters), author, path, combination and pagination.
- Frontend: three compact fields in the history toolbar (Message, Author, File) with Search/Clear; the store applies the search on load/loadMore/reload; in search mode the layout paints nodes without lanes.
- Closed on 2026-09-18 with green CI (Frontend 29 s, Rust 2m3s) in PR #14. With this, M3 is complete.
