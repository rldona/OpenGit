# OG-105 · i18n: operations, settings and help

- **Milestone:** M20 — Internationalization
- **Status:** backlog
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

- [ ] No literal UI string left in the listed components.
- [ ] Typed errors render a translated message chosen by kind, with the raw
      detail preserved in the output panel.
- [ ] English rendering unchanged; Spanish reads naturally.
- [ ] Tests assert the English rendering, a Spanish case and one error mapping.
- [ ] `lint`, `typecheck`, `format:check` and `npm test` green.

## Out of scope

- Native menu labels and backend-produced text (OG-106).
- Git's own output.

## Technical notes

- Error mapping lives next to `formatGitError` (bridge errors) so every caller
  benefits; do not duplicate a switch per component.

## Implementation notes

_(filled in when the ticket closes)_
