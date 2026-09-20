# OG-059 · Merge strategies and Merge in the native menu

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** done
- **Depends on:** OG-049
- **References:** ROADMAP.md, OG-049

## Context

OG-049 left merge with `--no-ff` and nothing else. The two modes SourceTree
offers in "Advanced" are still missing: `--squash` and resolving with a
strategy (`-X ours/theirs`). Also, the native menu has Fetch/Pull/Push but no
Merge, which already exists in the toolbar.

## Scope

- `merge_branch` accepts `squash: bool` and `strategy: "ours" | "theirs" | null`
  (validated in Rust, never interpolated).
- Merge dialog: "Squash changes" checkbox and strategy selector in an
  "Advanced" section with a note on what each one does.
- With `--squash` the result leaves the changes in the index without
  committing: the UI explains it and does not expect a merge commit.
- **Merge…** entry in the native menu that opens the dialog.

## Acceptance criteria

- [x] Squash on a merge with a resolved conflict leaves the changes staged and
      uncommitted, and this is communicated.
- [x] `-X ours`/`-X theirs` resolve content conflicts without leaving the
      operation half-done.
- [x] An invalid strategy never reaches git (validation in Rust).
- [x] The native menu opens the same dialog as the toolbar.
- [x] Integration tests: squash, ours, theirs and strategy validation.

## Out of scope

- Octopus merge and `--strategy-option` values other than ours/theirs.
- Saving the strategy as a per-repo preference.

## Technical notes

- `--squash` does not write `MERGE_HEAD`, so "conflict" and "success" are read
  the same as today, but the post-merge must not expect a commit: adjust the
  window text and the refresh.
- `-X ours/theirs` only applies to content conflicts; rename/delete ones still
  need manual resolution and the conflict flow.
