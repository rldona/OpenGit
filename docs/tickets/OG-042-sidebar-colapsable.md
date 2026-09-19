# OG-042 · SourceTree-style sidebar

- **Milestone:** M7 — SourceTree parity (phase 2)
- **Status:** done
- **Depends on:** OG-040
- **References:** ROADMAP.md, OG-040

## Context

OG-040 already computes and paints the incoming/outgoing commits per branch with ↓/↑ badges. What is missing to resemble SourceTree is the panel structure: today `RefsSidebar`, `StashSidebar` and `ExtrasSidebar` are always stacked expanded, with no way to collapse them, and with many remotes the panel becomes unmanageable.

## Scope

- Collapsible sections with chevron: Workspace, Branches, Remotes, Tags, Stashes, Submodules.
- Each remote (`origin`, `upstream`…) is a collapsible node with its branches inside.
- Collapse state persisted per section.
- Review the presentation of the existing ↓ badge so it reads like in SourceTree (`12↓` right-aligned in the row).

## Acceptance criteria

- [ ] Each section collapses and expands with the chevron, and the state survives restart.
- [ ] Remote branches hang from their remote, independently collapsible.
- [ ] The badge of commits still to download is shown right-aligned with the branch.
- [ ] Keyboard: the section header is a button with `aria-expanded`.
- [ ] Tests: collapse, persistence and grouping per remote.

## Out of scope

- Reordering sections by drag.
- Recomputing incoming/outgoing (already done in OG-040).

## Technical notes

- Grouping by remote comes from `refs/remotes/<remote>/<branch>`; watch out for branches that contain `/` in their name: the remote is only the first segment.
- Persist the collapse state together with the rest of the layout (`LAYOUT_KEYS`) so as not to invent another mechanism.
