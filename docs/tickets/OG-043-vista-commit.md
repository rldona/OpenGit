# OG-043 · Dedicated commit view

- **Milestone:** M7 — SourceTree parity (phase 2)
- **Status:** done
- **Depends on:** OG-044
- **References:** ROADMAP.md, OG-007

## Context

`CommitPanel` lives inside the status view, sharing space with the file list. In SourceTree, Commit is a screen of its own: staged and unstaged on top, a preview of the selected file on the right, and the message editor at the bottom with Cancel/Commit.

## Scope

- New `commit` view in `ViewName` (`ui.ts:5`).
- Layout: top split with **Unstaged** | **Staged**; on the right a preview of the selected file; at the bottom the message editor.
- Footer with **Cancel** (returns to the previous view without losing the written message) and **Commit**.
- Reuse `CommitPanel` (amend, hooks) and the existing staging components; do not reimplement stage/unstage.
- The commit shortcut and the native menu action lead to this view.

## Acceptance criteria

- [x] The Commit button in the toolbar opens the commit window (File status).
- [x] Selecting a file in staged or unstaged shows its diff in the preview.
- [x] Stage/unstage from this view updates both lists without reloading the whole UI.
- [x] Commit with an empty message is blocked and explained.
- [x] Cancel clears the draft (see implementation note).
- [x] Tests: navigation, preview on selection, blocking on empty message.

## Implementation (2026-09-19)

The final layout is not the one from the sketch in this ticket but that of **real
SourceTree** (screens provided by the user when requesting it): pending files with
Staged/Unstaged stacked on the left (checkbox per row, status glyph and "⋯"
menu), file content on the right with per-hunk staging, and at the bottom the
commit panel with git identity, `Commit Options…` (amend), immediate push and
Cancel/Commit. There is no separate `commit` view from `status`: in SourceTree
the commit window is that screen, so the Commit button in the toolbar leads to
File status.

Deviation: **Cancel clears the draft** instead of returning to a preview view,
because there is no preview view to return to; the message lives in the store and
the user can keep typing. If there is ever a previous view, that criterion can be
recovered by changing only the button handler.

## Out of scope

- Changing the hooks or amend flow (OG-007 already covers it).
- Commit message templates.
- Assisted co-authors and trailers.

## Technical notes

- The message draft already lives in `useCommitStore`; Cancel should only change the view, never clear it.
- The status view still exists: this view does not replace it, it complements it.
