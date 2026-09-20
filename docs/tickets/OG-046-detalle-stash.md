# OG-046 · Stash detail as a view

- **Milestone:** M7 — SourceTree parity (phase 2)
- **Status:** done
- **Depends on:** OG-030, OG-044
- **References:** ROADMAP.md, OG-030

## Context

OG-030 solved the diff of a stash with `StashDiffDialog`, a modal. A modal breaks the flow: you cannot compare with the history or navigate while it is open. With the 3-zone layout of OG-044 the natural place to show it embedded already exists.

## Scope

- When clicking a stash in the sidebar, the main zone shows its files on the left and the diff of the selected file on the right.
- Header with the stash message, its source branch and Apply / Pop / Drop actions (Drop with explicit confirmation).
- Remove `StashDiffDialog` once the view covers its function.

## Acceptance criteria

- [x] Clicking a stash shows its files and the diff without opening any modal.
- [x] The header shows the stash message and source branch.
- [x] Apply/Pop/Drop work from the view, and Drop asks for confirmation.
- [x] After Pop or Drop the view closes and the stash list refreshes.
- [x] Tests: selection loads files, Drop confirmation and subsequent refresh.

## Out of scope

- Partial or per-file stash.
- Editing the message of a stash.

## Technical notes

- Reuse the backend of OG-030; this is UI relocation, not new git functionality.
- Drop is destructive: it falls under rule 1 of AGENTS.md, explicit confirmation mandatory.
