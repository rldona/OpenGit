# OG-104 · i18n: sidebars and repository dialogs

- **Milestone:** M20 — Internationalization
- **Status:** backlog
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

- [ ] No literal UI string left in the listed components.
- [ ] English rendering unchanged; Spanish reads naturally.
- [ ] Existing dialog tests keep passing; add at least one Spanish case.
- [ ] `lint`, `typecheck`, `format:check` and `npm test` green.

## Out of scope

- Rust-side validation text: it is mapped through error kinds (OG-105).
- Server- or git-generated messages.

## Technical notes

- The `RemoteJobModal` titles come from `describeRemoteJob` (strings built in a
  plain module): route them through the non-reactive `t` from OG-099, not a
  hook.

## Implementation notes

_(filled in when the ticket closes)_
