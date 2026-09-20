# OG-056 · Remote management

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** ready
- **Depends on:** OG-011, OG-041
- **References:** ROADMAP.md, OG-034

## Context

The sidebar lists remotes and their branches, and the Branches menu already
shows `New Remote…` **disabled** because there is no backend. Adding or fixing
a remote forces you to drop out to the terminal: it is the most visible gap in
the UI.

## Scope

- Rust commands: `remote_add`, `remote_set_url`, `remote_rename` and
  `remote_remove` (argv, no shell; validated name).
- "New Remote…" dialog (name + URL) from the Branches context menu and from
  the Remotes one; URL shown under the name as the Pull dialog already does.
- Context menu for each remote: Edit URL, Rename and Remove (with explicit
  confirmation; deleting a remote does not touch local branches, but a warning
  says that its remote branches disappear from the repo).
- Refresh refs and output to the Output panel after each operation.

## Acceptance criteria

- [ ] Adding a remote with a valid URL appears in the sidebar and in the Pull
      dialog without restarting.
- [ ] Editing the URL and renaming work and refresh refs.
- [ ] Remove asks for confirmation and explains the effect.
- [ ] Duplicate or invalid name and empty URL are reported without a raw
      error.
- [ ] Integration tests on a temporary repo (add/rename/set-url/remove).

## Out of scope

- Credentials: the system credential helper still resolves them.
- `insteadOf`, separate `push url` and custom fetch refspecs.
- Creating the remote repository from the app.

## Technical notes

- `git remote rename` also updates local tracking branches: nothing extra
  needs to be done, but it is worth refreshing refs and status.
- Validating the name with `git check-ref-format` does not apply to remotes;
  use `git remote add` as validation and propagate its stderr.
