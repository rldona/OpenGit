# OG-060 · Drag & drop for merge and staging

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** ready
- **Depends on:** OG-049, OG-044, OG-009
- **References:** ROADMAP.md, OG-038

## Context

SourceTree allows dragging a branch onto the history to merge it and dragging
files between Staged and Unstaged to move them in or out of the index. Today
everything goes through context menus or checkboxes: it works, but the gesture
is missed.

## Scope

- Drag a branch from the sidebar and drop it onto the commit list (or the
  HEAD row): ask for confirmation indicating source and destination and run
  the merge from OG-049.
- Drag file rows between the Staged and Unstaged sections of the commit
  window: stage on drop into Staged and unstage on drop into Unstaged.
- Visual feedback during the drag (highlighted target) and cancellation with
  Escape.

## Acceptance criteria

- [ ] Dragging a branch and dropping it onto the history opens the confirmation
      and, if accepted, merges into the current branch.
- [ ] Dropping the current branch or a non-mergeable one does nothing (no
      confirmation).
- [ ] Dragging a file to the other section moves it in or out of the index and
      refreshes.
- [ ] With the mouse (pointer events), without breaking the normal selection
      click.
- [ ] Tests with pointer events on the mocked UI.

## Out of scope

- Dragging hunks or lines.
- Dragging between different repositories.
- Reordering columns by dragging.

## Technical notes

- Use Pointer Events (already used in splits and columns) and `dataTransfer`
  only to type the payload; in the WebView native DnD can be inconsistent, so
  consider a custom drag (pointermove + hit test) if it fails.
- The merge reuses `useMergeBranch` (confirmation + conflict view).
- For staging, the rows already know their section; the drop only decides the
  action.
