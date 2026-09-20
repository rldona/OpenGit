# OG-104 · i18n: sidebars and repository dialogs

- **Milestone:** M20 — Internationalization
- **Status:** done
- **Depends on:** OG-099, OG-100
- **References:** `docs/decisions/ADR-0009-i18n.md`

## Context

Sidebars and the repository dialogs (refs, remotes, stash, clone/create,
submodules, worktrees, LFS, hooks) still hardcode their labels, context menus
and validation messages.

## Scope

- Move every user-facing string into the catalog:
  - sidebars: `RefsSidebar`, `StashSidebar`, `ExtrasSidebar`;
  - dialogs: `BranchDialog`, `RemoteDialog`, `StashDialog`, `CloneDialog`,
    `CreateDialog`, `FetchDialog`, `PullDialog`, `MergeWindow`,
    `SubmoduleDialog`, `WorktreeDialog`, `LfsDialog`, `HookDialog`;
  - the context menus and validation/error messages they show.
- Reuse the catalog for the operation labels already used by jobs (pull/fetch/
  merge/tag) so the same action reads the same everywhere.

## Acceptance criteria

- [x] No literal UI string left in the listed components.
- [x] English rendering unchanged; Spanish reads naturally.
- [x] Existing dialog tests keep passing; add at least one Spanish case.
- [x] `lint`, `typecheck`, `format:check` and `npm test` green.

## Out of scope

- Rust-side validation text: it is mapped through error kinds (OG-105).
- Server- or git-generated messages.

## Technical notes

- The `RemoteJobModal` titles come from `describeRemoteJob` (strings built in a
  plain module): route them through the non-reactive `t` from OG-099, not a
  hook.

## Implementation notes (2026-09-21)

- Catalog sections `refs`, `stash`, `branchDialog`, `remoteDialog`, `clone`,
  `create`, `fetch`, `pull`, `merge`, `submodule`, `extras`, `lfs`, `hooks`,
  `jobs`, plus shared `common` keys reused by the dialogs.
- Migrated `RefsSidebar`, `StashSidebar`, `ExtrasSidebar`, `BranchDialog`,
  `RemoteDialog`, `StashDialog`, `CloneDialog`, `CreateDialog`, `FetchDialog`,
  `PullDialog`, `MergeWindow` (options and fetched panel), `SubmoduleDialog`,
  `WorktreeDialog`, `LfsDialog`, `HookDialog` and `RemoteJobModal`.
- `describeRemoteJob` (a plain module) and the remote store now use the
  non-reactive `t`; the job titles keep the SourceTree wording.
- Aria-labels that tests rely on (`Remote name`, `Fetch from repository`, …)
  keep their English text via dedicated keys separate from the visible label.
- Tests: `FetchDialog` renders in Spanish; the English assertions of the rest
  are unchanged. Verified `typecheck`, `lint`, `format:check` and `npm test`
  (547).
