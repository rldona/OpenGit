# OG-067 · Settings modal (SourceTree-style) with tabs

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** in-progress
- **Depends on:** OG-007, OG-056, OG-028
- **References:** ROADMAP.md, OG-056, OG-059

## Context

Today the gear opens a small popover with the theme, the Output toggle, the
shortcuts and "Close repository". SourceTree opens a tabbed **Settings modal**:
a header with the tab icons, a title, the tab body and Cancel/OK at the bottom.

The user wants that modal, with the tabs in this order:
**Advanced · Remotes · Security · Commit Template · Appearance**.

## Scope

A `SettingsWindow` modal opened from the toolbar gear (replacing the popover),
with a tab bar (icon + label), a title and Cancel/OK.

- **Advanced**
  - Repository-specific ignore list: show the path and an `Edit` button that
    opens the file in the system editor.
  - User information: `Use global user settings` checkbox, `Full Name` and
    `Email address` (repo-local `user.name`/`user.email`).
  - Miscellaneous: `Automatically refresh` (enables/disables the watcher for
    this repository).
  - Commit Text Replacements and "Disable recursive operations on submodules"
    are out of scope (SourceTree-specific / no submodules yet).
- **Remotes**
  - Name/Path table with `Add`, `Edit` and `Remove`, plus `Edit Config File…`.
  - Depends on the OG-056 backend (`remote_add`, `remote_set_url`,
    `remote_rename`, `remote_remove`).
- **Security**
  - `Enable GPG key signing for commits` checkbox and the signing key, stored
    as `commit.gpgsign` and `user.signingkey` (repo-local).
  - Key list from `gpg --list-secret-keys` with User/Type/Key/Created/Expires
    details. This is **commit signing**, unrelated to the app signing dropped
    in OG-028.
- **Commit Template**
  - `None` / `Default (Preferences)` / `Custom (this repository only)` and a
    template editor; stored as `commit.template` (repo-local).
- **Appearance**
  - Theme `System` / `Light` / `Dark`, reusing the theme store (global).

## Acceptance criteria

- [ ] The gear opens the modal with the five tabs in the given order.
- [ ] Advanced: user info round-trips (global vs local), the ignore file opens,
      and auto-refresh toggles the watcher.
- [ ] Remotes: add/edit/remove work and refresh the sidebar.
- [ ] Security: enabling signing and picking a key writes the config; the key
      details show.
- [ ] Commit Template: choosing None/Default/Custom and editing the template
      writes `commit.template`.
- [ ] Appearance changes the theme immediately.
- [ ] Cancel discards and OK applies; the modal closes with Escape.
- [ ] Tests: Rust for the config/remote/gpg commands; frontend for tabs,
      Advanced, Remotes, Security, Commit Template and Appearance.

## Out of scope

- Commit Text Replacements, background remote status and submodule recursion.
- Global (app-wide) preferences beyond the theme: SourceTree splits global
  Preferences from Repository Settings; here everything lives in one modal.
- Credentials, `insteadOf`, push URL and custom refspecs (OG-056).

## Technical notes

- Generic config commands (`config_get`/`config_set`/`config_unset` with a
  `local`/`global` scope) cover user info, commit template and signing, instead
  of one command per key.
- The ignore file is `<gitdir>/info/exclude`; resolve it with
  `git rev-parse --git-path info/exclude` rather than assuming `.git`.
- `Automatically refresh` must not reuse the transient `pause`/`resume` (used
  while the app itself writes): it needs a persistent switch on the watcher.
- Values are passed as argv (never a shell); the GPG key is validated.

## Delivery

Phased, small reviewable PRs with CI green between them:
- [x] Modal shell + Appearance + Advanced (config commands, ignore path,
      watcher switch).
- [ ] Remotes (OG-056 backend).
- [ ] Commit Template.
- [ ] Security (GPG).

### Phase 1 (done)

The modal opens from the gear with the tabs implemented so far (Advanced and
Appearance). Advanced round-trips the repository-local identity, shows and
opens `info/exclude`, and toggles the watcher; Appearance applies the theme on
OK. The remaining tabs are added in the next phases, in the requested order.
