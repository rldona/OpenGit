# OG-094 · Create and apply patches

- **Milestone:** M18 — History and content search depth
- **Status:** done
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

- [x] Exporting a single commit and a range writes the expected `.patch` files.
- [x] Applying a mailbox patch creates the commits; applying a plain diff
      changes the working tree.
- [x] A failed `am` is aborted so no half state is left behind; errors are
      readable.
- [x] Tests with temporary repositories; no network.
- [x] Checks green.

## Out of scope

- `git send-email` and patch series management.
- Editing patches inside the app.

## Technical notes

- `format-patch` writes files on disk: pick the folder with the native dialog
  and never overwrite silently.
- Prefer `git apply --check`/`git am --3way` so failures are caught early.

## Implementation notes (2026-09-20)

- Rust `format_patch` (`git format-patch -o <dir> [-1] <spec>`, rejecting specs
  that start with `-`) and `apply_patch` (`git am` or `git apply`, optional
  `--3way`; a failed `am` runs `git am --abort`).
- Commit context menu: **Create Patch…** (single) and **Create Patches to
  HEAD…** (range), both into a picked folder, with the file list in the Output
  panel. File → **Apply Patch…** opens a dialog (file, mailbox/diff, three-way).
- Tests: integration tests for a single commit, a range, `am` and `apply`; the
  Apply Patch dialog and the menu route.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (70 files, 514
  tests), `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check`.
