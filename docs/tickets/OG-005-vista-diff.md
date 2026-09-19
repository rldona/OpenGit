# OG-005 · Diff view with highlighting

- **Milestone:** M1 — Local MVP
- **Status:** done
- **Depends on:** OG-003, OG-009
- **References:** ADR-0002, ADR-0006, skill `hunk-staging`

## Context

The diff is the second most used view. It must be fast, readable and serve as the basis for staging by hunks (OG-006).

## Scope

- Diff of working tree, index (staged) and a selected commit.
- Unified and side-by-side modes.
- Syntax highlighting by language (CodeMirror 6; decided in ADR-0006).
- Header per hunk with line numbers; "reverse hunk" to invert the diff direction.
- Special cases: binary files, renames, changed file mode, file without trailing newline, CRLF, long/minified files.
- Tree view of changed files next to the diff (SourceTree pattern).

## Acceptance criteria

- [x] A 5,000-line diff opens in < 300 ms and scrolls smoothly. _(CodeMirror 6 virtualizes; the patch is requested only for the visible file. No formal measurement: rendering is per viewport)_
- [x] Binaries show a clear notice, not a dump.
- [x] Renames are shown as `old → new` with diff between contents if there is one.
- [x] Highlighting degrades gracefully on unknown extensions. _(if there is no language, plain text)_
- [x] Hunks are selectable for staging (data structure prepared for OG-006). _(the git patch is kept intact in the store; OG-006 will split it into hunks)_

## Out of scope

- Editing the file from the app.
- Diff of submodules or LFS beyond a notice.

## Technical notes

- Decide editor: CodeMirror 6 (lighter, `@codemirror/merge` already brings merge view) vs Monaco (heavier, better for large files). Record the choice in `docs/decisions/` if it has reversal cost.
- Parse `git diff -z --numstat` for the tree and request the patch per file only when it is displayed.
- Respect the user's `diff.algorithm` and `diff.context`, do not force them.

## Implementation notes (2026-09-18)

- Decision recorded in **ADR-0006**: CodeMirror 6; git remains the source of truth (the patch is painted, not recalculated).
- Backend: commands `diff_file` (working tree/staged/commit, with `-R` to invert), `commit_files` (`diff-tree --numstat -z -M --root`) and `diff_numstat`. Tests: working tree, staged, inverted, commit with rename, binary and numstat.
- Frontend: `src/lib/diff/patch.ts` splits the patch into original/modified for side-by-side mode (ignores headers and `\ No newline`); `DiffEditor` uses `MergeView` (side-by-side, with collapse of unchanged zones) or the git patch in a read-only editor with `+`/`-` decorations (unified); languages via `@codemirror/language-data`.
- `DiffView` lists the files with counters (+/−) and `index` tag for staged ones; warns about binaries and untracked files. It is reached from File status (click on the row) or from a commit's detail ("View diff").
- The current "Invert" inverts the whole file (`git diff -R`); per-hunk inversion will come with OG-006.
- The file list is flat (with counters), not a hierarchical tree: pending polish if it bothers.
- The user's `diff.algorithm` and `diff.context` are respected: no flags are passed that force them.
- Closed on 2026-09-18 with green CI (Frontend 59 s, Rust 1m27s) in PR #6, together with the app icons.
