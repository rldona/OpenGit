# OG-039 · SourceTree-style status/diff panels

- **Milestone:** M6 — Visual parity with SourceTree
- **Status:** done
- **Depends on:** OG-038
- **References:** ROADMAP.md

## Context

The patch viewer shows lines without numbering and with a hunk header that only shows the `@@…@@`; the diff file panel cannot be filtered. In SourceTree each hunk carries its range and each line its old/new numbers, and the file panel has search.

## Scope

- Pure parser: `parseHunkHeader` (old/new ranges and section) and `classifyPatchLines` with `oldLine`/`newLine` per line (adds only new, deletes only old, context in both, markers without number).
- `PatchView` with line-number columns (old and new, monospaced, right-aligned) and hunk header with `Hunk N · Lines x–y` label plus the existing actions (Stage/Unstage/Discard) on the right.
- Search box in the diff file panel (filters by path, case-insensitive, includes `orig_path` of renames) with empty state "No files match".
- Filtering does not touch the selection or the store state; only what is rendered.

## Acceptance criteria

- [x] Each line of the patch shows its old/new number when applicable and stays empty when not.
- [x] The hunk header shows the index and the new range, and keeps the staging actions.
- [x] Typing in the panel's search box filters the files and "No files match" appears if nothing matches.
- [x] Tests: parser (ranges and numbering), PatchView (columns and label) and DiffView (filter).

## Out of scope

- Searching inside the patch itself.
- Collapsible "Sorted by path" control and other orderings.
- Numbering in side-by-side mode (CodeMirror already renders its gutters).

## Technical notes

- `parseHunkHeader` accepts the format `@@ -a[,b] +c[,d] @@ section` and returns `null` if it does not fit; with counts 0 the start is used as the only line.
- Numbering is computed in the same pass as classification, so keeping it is O(n) without extra structures.
- The diff search box is local state (`useState`) and filters `files` before rendering tree or list.

## Implementation notes (2026-09-18)

- Pure `parseHunkHeader` (`@@ -a[,b] +c[,d] @@ section`) and `classifyPatchLines` with `oldLine`/`newLine` in the same pass; the `\ No newline` markers and the headers stay without a number.
- `PatchView`: number columns (40 px, mono, muted), `Hunk N · Lines x–y` label with the header section next to it and staging actions on the right.
- `DiffView`: local "Filter files" input that filters by path and `orig_path`; "No files match" state without touching the selection.
- Tests: 228 frontend (parser numbering, hunk label and filter) and 120 Rust untouched.
- Closed on 2026-09-18 with green CI (Frontend 36 s, Rust 1m30s) in PR #36.
