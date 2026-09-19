# OG-048 · Visual identity (badges, icons, dates)

- **Milestone:** M7 — SourceTree parity (phase 2)
- **Status:** done
- **Depends on:** —
- **References:** ROADMAP.md, OG-022, OG-037

## Context

M6 placed the elements where they belong, but comparing screenshots against SourceTree the app still does not look alike, and it is not because of the layout but because of the finish: the ref badges are almost all the same washed-out tone (18 % alpha fill, no icon), the sidebar sections have no icon, the author is shown without email and the dates are absolute.

This ticket collects what M7 did not ticket: the **visual identity**, not the structure.

## Scope

- **Ref badges:** glyph per type (branch, remote branch, tag) and a saturated color distinguishable at a glance: local, remote and tag must read as three different things without getting close.
- **Section icons** in the sidebar (Workspace, Branches, Tags, Remotes, Stashes, Submodules), as a visual anchor for each block.
- **Relative dates** in the table: `Today at 22:17`, `Yesterday at …`, and absolute beyond a certain age.
- **Author with email** in the Author column (`Name <email>`), truncated with ellipsis.
- Review row density and the highlight of the selected row (SourceTree marks the selection across the full width).
- Everything must work in light and dark theme (OG-022).

## Acceptance criteria

- [ ] Local branch, remote branch and tag are distinguished by color and glyph without reading the text.
- [ ] Each sidebar section has its icon.
- [ ] Recent dates are shown relative and old ones absolute.
- [ ] The Author column shows name and email, truncating without breaking the row.
- [ ] The selected row is highlighted across the full width.
- [ ] Enough contrast in both themes.
- [ ] Tests: date formatting (today, yesterday, old) and badge classification by ref type.

## Out of scope

- Customizable icons or icon packs.
- Changing the typeface family.
- Author avatars (SourceTree paints them; it requires network or local cache, and rule 8 forbids network in tests).

## Technical notes

- Relative formatting needs an injectable "now" reference so that tests are deterministic; no direct `Date.now()` inside the component.
- Colors go as theme CSS variables, not hardcoded, so as not to break OG-022.
- `renderRefs` already trims to 3 refs with a `+N`: when adding glyphs, check that the row still does not overflow.
