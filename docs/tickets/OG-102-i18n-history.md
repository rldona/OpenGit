# OG-102 · i18n: history and commit views

- **Milestone:** M20 — Internationalization
- **Status:** done
- **Depends on:** OG-099, OG-100
- **References:** `docs/decisions/ADR-0009-i18n.md`

## Context

OG-099 introduced the typed catalog and migrated the shell. The history area is
the most visible remaining surface and still has hardcoded English strings.

## Scope

- Move every user-facing string of the history area into the catalog with an
  English source and a Spanish translation, without changing the English
  rendering:
  - `HistoryView`, `CommitDetailPanel`, `CommitPanel`, `FileTree`;
  - `GraphCanvas` labels/tooltips and the visible range/empty states;
  - `MergeFromLogPanel`.
- Use parameters (`{count}`, `{branch}`, `{name}`) instead of concatenation.
- Dates and numbers go through `Intl` with the active locale.

## Acceptance criteria

- [x] No literal UI string left in the listed components (only brand names and
      technical identifiers).
- [x] English rendering unchanged; Spanish reads naturally.
- [x] Tests assert the English rendering and at least one Spanish case.
- [x] `lint`, `typecheck`, `format:check` and `npm test` green.

## Out of scope

- Diff, status and the other views (OG-103..OG-105).
- Translating commit messages, branch names or file contents.

## Technical notes

- Components use `useI18n()`; avoid calling it inside per-row render helpers,
  pass `t` down or memoise.
- The canvas does not inherit CSS; it only gets strings from props/state.

## Implementation notes (2026-09-21)

- Catalog sections `common`, `columns`, `history`, `commit` and `mergeLog`.
- `HistoryView` (filters, search, results, file history, column headers, row
  tooltips and the whole commit context menu), `CommitPanel`, `CommitDetailPanel`
  and `MergeFromLogPanel` now use `useI18n`; `GraphCanvas` and `FileTree` had no
  user-facing strings.
- `columns.ts` keeps the header order; the labels come from the catalog through
  `COLUMN_MESSAGES`.
- Tests: `CommitPanel` renders in Spanish (`Mensaje del commit`, `Cancelar`); the
  English assertions of the rest are unchanged. Verified `typecheck`, `lint`,
  `format:check` and `npm test` (545).
