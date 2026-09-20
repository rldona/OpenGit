# OG-063 · Merge window (Merge From Log)

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** done
- **Depends on:** OG-049, OG-044
- **References:** ROADMAP.md, OG-059

## Context

OG-049 shipped a merge dialog with a branch picker and `--no-ff`. SourceTree's
merge window is more powerful: its default tab is a **log picker** — the commit
table with graph and filters, the selected commit's files and patch preview
below, and the merge options at the bottom. "Merge Fetched" (the branch picker)
is the second tab.

That matters for real work: often the thing to merge into the current branch is
a specific commit (a hotfix, someone else's branch head) that is easier to find
in the log than in a branch dropdown.

## Scope

- **Merge window** replacing the current dialog, with two tabs:
  `Merge From Log` (default) and `Merge Fetched`.
- **Log tab**:
  - Commit table with graph and single selection, reusing the graph canvas.
  - Filters: branch dropdown (`All Branches` + locals, and remotes when the
    toggle is on), `Show Remote Branches` toggle, `Ancestor Order` toggle
    (limits the log to ancestors of HEAD) and a text search over the loaded
    commits.
  - `Jump to:` a ref: selects and scrolls to that branch/tag commit.
  - Detail below: the selected commit's file list and patch, read-only,
    reusing `DiffFilesPanel`/`DiffPatchPanel`.
  - Options: `Commit merge immediately (if no conflicts)` → `--no-commit` when
    off; `Include messages from commits being merged in merge commit` →
    `--log`; `Create a commit even if merge resolved via fast-forward` →
    `--no-ff`; `Rebase instead of merge` → `--rebase`.
- **Merge Fetched tab**: the current branch picker, with the same options.
- **Backend**: `merge_branch` gains `no_commit` and `include_messages`
  (`--no-commit`, `--log`); `rebase` already exists in the pull options and has
  to be added here too.
- OK runs the merge with the selected rev and options; a conflict keeps the
  existing flow (conflict view + operation banner).

## Acceptance criteria

- [x] The Merge button opens the window on the log tab, with the commit table
      and the graph.
- [x] Selecting a commit shows its files and patch below, and OK merges that
      rev into the current branch with the chosen options.
- [x] The four options map to the git flags and are covered by tests.
- [x] `Jump to:` selects and scrolls to a ref's commit.
- [x] `Ancestor Order` limits the list to ancestors of HEAD; the branch filter
      and the search combine with it.
- [x] The Merge Fetched tab keeps working as today.
- [x] Closing the window restores the diff view that was behind it.
- [x] Tests: Rust for the new flags, frontend for tabs, filters, jump-to,
      options and the merge call.

## Out of scope

- `--squash` and `-X ours/theirs` (OG-059).
- Infinite scroll inside the window: it works over the loaded page (200
  commits) and the search; loading more pages is a follow-up if it hurts.
- Resolving conflicts inside the window.

## Technical notes

- The diff preview reuses the diff store, so opening the window snapshots it
  and closing restores it: the view behind the modal must not change.
- The log state (commits/layout) is reused from the log store; the window's
  selection is local so the main view's selection is untouched.
- The graph canvas positions rows by index; with the window's fixed page it
  needs no virtualization, but the rows and the canvas must share the same
  `ROW_HEIGHT` contract.

## Closing notes

- `Rebase instead of merge` runs `git rebase <rev>`: `git merge` has no
  `--rebase`, SourceTree rebases the current branch onto the picked rev.
- Conflicts are detected by unmerged index entries (`git ls-files --unmerged`),
  not by `MERGE_HEAD`: a clean `--no-commit` merge also leaves `MERGE_HEAD`.
- The preview borrows the diff store and restores it when the window closes,
  so the view behind the modal does not change.
