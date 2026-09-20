# OG-094 · Create and apply patches

- **Milestone:** M18 — History and content search depth
- **Status:** ready
- **Depends on:** OG-003
- **References:** `src-tauri/src/git/`, `src/components/`

## Context

Patches are how changes move between repositories and into bug trackers. Today
the app can show a diff but not export it as a patch or apply one, so the user
drops to the terminal for `format-patch`, `am` and `apply`.

## Scope

- **Create**: `git format-patch` for a commit or a range into a chosen folder
  (default: a temporary/export folder), with `-o`; show the resulting files.
- **Apply**: `git am` for a mailbox patch and `git apply` for a plain diff, from
  a file chosen with the native picker; stream progress and surface errors.
- Offer `-3` (three-way) when applying, so conflicts land in the existing
  conflict editor.

## Acceptance criteria

- [ ] Exporting a single commit and a range writes the expected `.patch` files.
- [ ] Applying a mailbox patch creates the commits; applying a plain diff
      changes the working tree.
- [ ] A malformed or conflicting patch produces a readable error and no half
      state (or a clean `am --abort`).
- [ ] Tests with temporary repositories; no network.
- [ ] Checks green.

## Out of scope

- `git send-email` and patch series management.
- Editing patches inside the app.

## Technical notes

- `format-patch` writes files on disk: pick the folder with the native dialog
  and never overwrite silently.
- Prefer `git apply --check`/`git am --3way` so failures are caught early.
