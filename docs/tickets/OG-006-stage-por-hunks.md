# OG-006 · Stage/unstage by hunks and lines

- **Milestone:** M1 — Local MVP
- **Status:** done
- **Depends on:** OG-005
- **References:** skill `hunk-staging`, ADR-0003

## Context

It is the most used feature in day-to-day work and the main reason not to open the terminal: preparing partial commits.

## Scope

- Select hunks, individual lines or ranges and pass them to the index.
- Equivalent unstage from the staged diff.
- Stage/unstage of a whole file.
- The diff UI reflects the resulting state without reloading the whole view.
- Correct handling of: CRLF, file without trailing newline, EOF marker, new and deleted files, renames.

## Acceptance criteria

- [x] Staging a hunk updates the index (verified with `git diff --cached`) without touching the working tree. _(integration test with two hunks)_
- [x] Staging loose lines inside a hunk produces the correct patch, including the edges. _(test with the first/last line and conversion to context of the unselected ones)_
- [x] Unstage returns the exact content to the working tree. _(the index goes back to HEAD and the file on disk is not touched)_
- [x] CRLF and absence of trailing newline do not corrupt the file after staging. _(bytes are compared with `git show :fichero` and with disk)_
- [x] File names with spaces, quotes or UTF-8 work. _(test with spaces and UTF-8; quotes are not valid in Windows names and are covered by argument passing)_

## Out of scope

- Editing the content during staging.
- Historical interactive stage (`git add -p` guided by console).

## Technical notes

- Implementation by patches: reconstruct the selected hunk, `git apply --cached -` (stdin) for stage and `git apply --cached --reverse -` for unstage. The patch is passed via stdin, never via a temporary file in the repo.
- Normalize the hunk headers (`@@ -a,b +c,d @@`) when trimming lines; a miscalculated offset corrupts the patch.
- Mandatory integration test: temporary repo, partial stage, verify with `git diff --cached --numstat` and with the content read from disk.
- The internal representation of the hunk must preserve the exact byte of each line so as not to alter the file.

## Implementation notes (2026-09-18)

- `src/git/patch.rs`: parser and patch builder **in bytes** (`parse`, `ParsedPatch::build`). Selection: file, hunk (index) or lines (global indices). Unselected `-` lines become context (otherwise the patch does not apply); unselected `+` are omitted; `\ No newline` markers are kept only if their line remains. Hunks without changes are discarded.
- Application in `git::stage_selection` → `git apply --cached --recount --whitespace=nowarn -` via stdin, with `--reverse` for unstage; the whole file is resolved with `git add -A --`/`git restore --staged --`.
- UI: in **unified** mode the patch is painted with `PatchView` (virtualized): button per hunk, selection of `+`/`-` lines by click and file buttons such as "Stage file"/"Stage N lines". In commits staging is disabled. After applying, only the patch is reloaded and the status is refreshed.
- Tests: 5 staging integration tests (hunk, lines, unstage, CRLF/no newline, paths) + 6 parser unit tests; 54 frontend.
- Along the way, a flakiness in the tests was fixed: `TempDir`s could collide (same `pid+nanos` in parallel tests) and now they carry an atomic counter (see `.ai/memory/dev-environment.md`).
- Closed on 2026-09-18 with green CI (Frontend 25 s, Rust 1m9s) in PR #8.
