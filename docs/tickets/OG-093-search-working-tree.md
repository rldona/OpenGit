# OG-093 · Search the working tree (git grep)

- **Milestone:** M18 — History and content search depth
- **Status:** done
- **Depends on:** OG-018
- **References:** `src-tauri/src/git/`, `src/components/`

## Context

Commit search (OG-018) looks at messages and paths; there is no way to find a
string in the files of the working tree. SourceTree offers a grep over the
worktree, and it is the fastest way to locate code before opening it.

## Scope

- Rust command running `git grep` with `--line-number`, `--null`/`-z`-friendly
  output and `--` before the pattern so it can never be read as an option.
- Options: case sensitivity, whole word, regular expression and an optional
  path/glob filter; ignore binary files.
- UI: a search panel with the query, the options and a results list grouped by
  file; clicking a result opens the file (preview) and, when possible, the diff.
- Cap the number of results and report it, so a broad query cannot freeze the
  UI.

## Acceptance criteria

- [x] Searching a string lists matches grouped by file with line numbers.
- [x] Case, whole-word and regex options change the results accordingly.
- [x] Clicking a result opens that file in the diff view.
- [x] The pattern is passed as a single argv element; no shell.
- [x] Tests: parser with a real fixture; a temporary repository for the search;
      frontend with the bridge mocked.
- [x] Checks green.

## Out of scope

- Search and replace (editing files is out of scope).
- Searching history content (`git log -S`/`-G`), a separate idea.
- Indexing for instant search.
- Jumping to the matched line inside the diff editor; the result opens the
  file's diff, not the exact line yet.

## Technical notes

- `git grep` output is `path:line:content` per match; use `-z` where it helps
  and split on the first separators, never assuming a locale (rule 4).
- The worktree can be huge: bound the result count and keep the call async and
  cancellable.

## Implementation notes (2026-09-20)

- Rust: `grep_worktree` builds `git grep --line-number --null --no-color -I`
  with `-i`/`-w`/`-E` or `-F`, the pattern after `-e` and an optional pathspec
  after `--`; `parse_grep` reads the `path\0line\0text` records (exit code 1 is
  "no matches", not an error) and the result is capped at 200 with a
  `truncated` flag.
- Frontend: `grep` store (query, options, results) and a `SearchView` reachable
  from the Workspace sidebar; clicking a result opens the file's worktree diff.
- Tests: parser unit tests, an integration test over a temporary repository
  (options and cap), the store and the view.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (69 files, 511
  tests), `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check`.
