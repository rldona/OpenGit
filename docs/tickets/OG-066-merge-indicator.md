# OG-066 · Merge indicator: busy while running, banner only if left unfinished

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** done
- **Depends on:** OG-019, OG-020, OG-049, OG-063, OG-065
- **References:** ROADMAP.md

## Context

The operation banner ("merge in progress" with Abort/Continue) reflects git's
real state, read from `MERGE_HEAD`. Two problems:

- It can stay on screen after the merge is finished. Finalizing a conflicted
  merge from the Commit panel does not re-check the operation state, and the
  watcher does not refresh it either, so the banner lingers even though there
  is nothing left to continue.
- While `git merge` is running there is no indication at all.

The banner should mean exactly one thing: an operation left unfinished
(conflict or `--no-commit`). While the command runs, a busy state should say so.

## Scope

- Busy while running: the toolbar Merge button is disabled and reads
  `Merging…` while the merge command runs, and `Merging <rev>…` is written to
  the Output panel before the result.
- Banner only when the operation is left unfinished: it appears on conflicts
  and `--no-commit` merges, and disappears once they are committed, continued
  or aborted.
- Refresh the operation state:
  - after a commit (a commit can finalize a merge);
  - from the shared `refreshRepo` (OG-065), so the watcher and the Refresh
    button also pick up merges completed outside the app.

## Acceptance criteria

- [x] The Merge button is disabled and reads `Merging…` while a merge runs.
- [x] The Output logs the merge start and its result.
- [x] Committing a conflicted merge clears the banner without extra actions.
- [x] The watcher and Refresh refresh the operation state.
- [x] Tests cover the busy state, the Output start line and the state refresh.

## Out of scope

- A busy state for the other operations (cherry-pick, revert, rebase, reset).
- Progress percentages: `git merge` has no step count to report.

## Technical notes

- `useCommitStore.load` refreshes `opState` but also re-reads the author
  identity; a lightweight `refreshOpState(root)` avoids that for the watcher
  path and the post-commit refresh.
- `refreshRepo` is the single refresh path shared by the button and the
  watcher (OG-065); the operation state belongs there too, or it drifts again.
