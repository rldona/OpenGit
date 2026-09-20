# OG-103 · i18n: diff, status and staging

- **Milestone:** M20 — Internationalization
- **Status:** backlog
- **Depends on:** OG-099, OG-100
- **References:** `docs/decisions/ADR-0009-i18n.md`

## Context

The diff and staging area is the second big surface with hardcoded strings:
hunk actions, file states, image comparison and search results.

## Scope

- Move every user-facing string of the diff/status area into the catalog:
  - `DiffView`, `DiffFilesPanel`, `DiffPatchPanel`, `DiffEditor`,
    `ImageDiffPanel`;
  - `StatusView` (states, warnings, per-file actions);
  - `BlameView`, `SearchView`, `PatchView`, `WorktreeDetailPanel`.
- Use parameters for counts, paths and modes.
- Keep git-origin text (diff content, commit subjects) untouched.

## Acceptance criteria

- [ ] No literal UI string left in the listed components.
- [ ] English rendering unchanged; Spanish reads naturally.
- [ ] Tests assert the English rendering and at least one Spanish case.
- [ ] `lint`, `typecheck`, `format:check` and `npm test` green.

## Out of scope

- History/commit views (OG-102) and operations/dialogs (OG-104..OG-105).
- Localizing the diff content itself.

## Technical notes

- The file tree and patch lists can be long: resolve messages once per render,
  not per row.
- Keep side-by-side/unified and whitespace option labels in the catalog so the
  two modes stay consistent.

## Implementation notes

_(filled in when the ticket closes)_
