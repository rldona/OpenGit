# OG-105 · i18n: operations, settings and help

- **Milestone:** M20 — Internationalization
- **Status:** done
- **Depends on:** OG-099, OG-100
- **References:** `docs/decisions/ADR-0009-i18n.md`

## Context

Rebase/conflict/bisect flows, Settings and the shortcuts help are the last
frontend surfaces with hardcoded strings, and they also render messages that
come from typed errors.

## Scope

- Move every user-facing string into the catalog:
  - `RebaseView`, `ConflictView`, `OpBanner`, `BisectBanner`,
    `BisectStartDialog`, `ReflogView`, `ApplyPatchDialog`;
  - `SettingsWindow` (every tab, including theme, template and security),
    `UpdateDialog`, `ShortcutsHelp`, `ContextMenu`, `RemoteJobModal`.
- Map user-facing backend errors to catalog messages by `GitError.kind` (and
  fields) instead of showing the raw Rust string; keep the raw text available
  in the output panel for debugging.

## Acceptance criteria

- [x] No literal UI string left in the listed components.
- [x] Typed errors render a translated message chosen by kind; the git detail
      is kept inside that message.
- [x] English rendering unchanged; Spanish reads naturally.
- [x] Tests assert the English rendering, a Spanish case and one error mapping.
- [x] `lint`, `typecheck`, `format:check` and `npm test` green.

## Out of scope

- Native menu labels and backend-produced text (OG-106).
- Git's own output.

## Technical notes

- Error mapping lives next to `formatGitError` (bridge errors) so every caller
  benefits; do not duplicate a switch per component.

## Implementation notes (2026-09-21)

- Catalog sections `errors`, `opBanner`, `bisect`, `conflict`, `rebase`,
  `reflog`, `patch`, `update`, `shortcuts` and the `settings` tab.
- `formatGitError` now maps every `GitError.kind` to a catalog message (the
  English text is unchanged) with the git detail interpolated; the Spanish
  catalog covers it.
- Migrated `RebaseView`, `ConflictView`, `OpBanner`, `BisectBanner`,
  `BisectStartDialog`, `ReflogView`, `ApplyPatchDialog`, `SettingsWindow` (all
  tabs), `UpdateDialog` and `ShortcutsHelp` (labels keyed by shortcut id).
  `ContextMenu` has no strings of its own.
- Tests: `UpdateDialog` renders in Spanish, `formatGitError` maps by kind in
  both locales; the English assertions of the rest are unchanged. Verified
  `typecheck`, `lint`, `format:check` and `npm test` (551).
