# OG-071 · Preview untracked files in the diff view

- **Milestone:** Next (post-M8)
- **Status:** done
- **Depends on:** OG-005, OG-009
- **References:** `src/components/DiffPatchPanel.tsx`, `src/lib/stores/diff.ts`, `src-tauri/src/git/mod.rs`

## Context

Selecting a new (`?`) file in the diff view shows "Untracked file: no diff
yet. Stage it to see the content." instead of its content. The content is
available in the working tree, so a read-only preview should render without
staging first.

## Scope

- New backend diff for untracked files via
  `git diff --no-color --no-ext-diff --no-index -- /dev/null <file>`
  (argv array, no shell), exposed as the `untracked_file_diff` command.
  Exit codes 0/1 with non-empty stdout are success (1 = differences);
  empty stdout or other codes are errors (e.g. file deleted mid-flight).
- Frontend fetches the preview on selection and renders it read-only in
  both unified (`PatchView` with `staging={false}`) and side-by-side
  (`DiffEditor`) modes, with `+N` counts in the header from the patch.
- Binary untracked files show the existing "Binary file" message; empty
  files show "Empty file". Image preview stays tracked-only.
- Staging (hunk, lines, file) from the untracked preview stays disabled.

## Acceptance criteria

- [x] Selecting an untracked text file renders its content as all-added
  lines in unified and side-by-side modes.
- [x] Untracked binary files show the binary message; empty files show an
  empty message; no "no diff yet" text remains.
- [x] No staging/discard actions are offered on the untracked preview.
- [x] `npm run typecheck`, `npm run lint`, `npm test`,
  `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check` green.

## Out of scope

- Partial or full staging of untracked files from the preview.
- Image preview for untracked images.
- Blame/file history on untracked files.

## Technical notes

- Verified empirically: `--no-index` prints a `new file` patch with
  `--- /dev/null`, exits 1 on differences (also 1 with empty/missing file,
  hence the non-empty-stdout check), and prints
  `Binary files /dev/null and b/… differ` for binaries, which the existing
  `isBinaryPatch` already detects.

## Implementation notes (2026-09-19)

- Rust: `git::untracked_file_diff` (`diff --no-color --no-ext-diff
  --no-index -- /dev/null <file>`, unchecked run, 0/1 + non-empty stdout
  accepted) + `untracked_file_diff` Tauri command registered in
  `generate_handler!`.
- Frontend: `untrackedFileDiff` bridge; `selectFile` fetches the preview
  with loading/error states; `DiffPatchPanel` renders it read-only in both
  modes (`staging={false}`, no discard), with `+N` header counts from
  `patchCounts`, "Empty file" for hunk-less patches and the binary message
  for binaries. `DiffView` needed no changes (already gates actions on
  `!untracked`).
- Tests: Rust `diff_of_untracked_text_binary_empty_and_missing` (text,
  non-ASCII name, binary, empty, missing-is-error); store preview + binary
  cases; `DiffView` read-only preview case.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (55 files,
  436 tests), `cargo test` (25 suites ok), `clippy -D warnings`,
  `cargo fmt --check` green.
