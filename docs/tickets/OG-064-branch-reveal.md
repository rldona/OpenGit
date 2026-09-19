# OG-064 · Clicking a branch selects its commit in the history

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** done
- **Depends on:** OG-051, OG-044
- **References:** ROADMAP.md, OG-051

## Context

Tags already locate their commit: OG-051 made clicking a tag switch to the
history view, select the commit it points to and scroll to it. Branches (local
and remote) only get marked as selected in the sidebar; the commit panel does
not move, so the user has to find the branch tip by hand.

SourceTree behaves like the tags do: clicking a branch highlights its tip commit
in the log and shows its detail.

## Scope

- Clicking a local branch in the sidebar reveals its tip commit in the history
  view (select + scroll), reusing the existing `reveal` path.
- The same for remote branches (inside each remote group).
- The branch keeps the visual selection in the sidebar, and the current branch
  marker is untouched.
- No checkout on click: the context menu still owns `Checkout` and `Merge`.

## Acceptance criteria

- [x] Clicking a local branch selects its tip commit and switches to history.
- [x] Clicking a remote branch selects its tip commit and switches to history.
- [x] Clicks still do not trigger a checkout.
- [x] The branch remains visually selected in the sidebar.
- [x] Tests cover both cases.

## Out of scope

- Filtering the log to the branch (only the commit is selected).
- Selecting the commit when the branch is created or renamed.

## Technical notes

- `reveal(ref)` already does the three things needed (`setSelectedRef`,
  `setActiveView("history")`, `revealCommit`); the change is to point the
  branch `onClick` handlers at it. `revealCommit` loads more pages when the tip
  is not in the loaded one and clears an active branch filter if it hides it.
