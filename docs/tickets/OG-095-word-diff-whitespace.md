# OG-095 · Word-level diff and ignore-whitespace options

- **Milestone:** M18 — History and content search depth
- **Status:** done
- **Depends on:** OG-005
- **References:** `src-tauri/src/git/`, `src/components/DiffView.tsx`, ADR-0006

## Context

Line-based diffs are noisy when only a word or the indentation changed.
SourceTree lets the user switch to a word diff and ignore whitespace; the app
always asks git for the plain unified diff.

## Scope

- Diff options surfaced in the diff view: **ignore whitespace**
  (`--ignore-all-space`), **ignore blank lines** (`--ignore-blank-lines`) and
  **word diff** (`--word-diff=plain`, rendered as the patch git returns).
- Apply the options to both the working-tree and commit diffs (and the compare
  view), passing them through to `git diff`.
- Persist the last choice per session (not a global preference).

## Acceptance criteria

- [x] Toggling the options changes the returned patch and the rendering.
- [x] Word diff marks the changed words instead of whole lines.
- [x] The options work for working-tree, commit and compare diffs.
- [x] Tests: the command builds the right args; the view renders the returned
      patch unchanged.
- [x] Checks green.

## Out of scope

- A semantic/AST diff.
- Per-option global preferences.

## Technical notes

- `--word-diff=plain` keeps the patch text parseable; the CodeMirror layer
  (ADR-0006) still paints what git returns, it does not compute the diff.
- Ignoring whitespace changes what can be staged later (OG-006): keep the
  staging patch unstyled and separate from the view options.

## Implementation notes (2026-09-20)

- Rust: `DiffOptions` (`-w`, `--ignore-blank-lines`, `--word-diff=plain`) is
  threaded through `worktree_file_diff`, `commit_file_diff` and
  `compare_file_diff` (and their commands).
- Frontend: the diff store keeps the options for the session and reloads the
  patch when one is toggled; the DiffView toolbar shows three toggles. The
  untracked preview ignores them (a new-file patch), so they are disabled there.
- Tests: integration tests for `--word-diff=plain` and `--ignore-all-space`;
  the store reload case and the updated request expectations.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (70 files, 515
  tests), `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check`.
