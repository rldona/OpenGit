# OG-025 · Git LFS: detection and warnings

- **Milestone:** M5 — Polish
- **Status:** done
- **Depends on:** OG-002, OG-009
- **References:** ROADMAP.md

## Context

In repos with Git LFS, if `git-lfs` is not installed the managed files look like text pointers (version/oid/size) and the app does not warn about it: they look like normal changes.

## Scope (v1)

- Backend: `lfs_status(path) -> { installed, version, configured }`.
  - `installed`/`version`: output of `git lfs version`; if git-lfs is not there, it is not an error.
  - `configured`: there is `filter=lfs` in some tracked `.gitattributes` (including subdirectories).
- Warning in **File status** when the repo uses LFS and `git-lfs` is not installed.
- **Git LFS** section in the extras sidebar when the repo configures it, with version or not-installed warning.
- Warning in the diff view when the patch is an **LFS pointer** (version + oid + size): the real content is not available; the short oid and size are shown.
- Read-only: LFS is not installed and objects are not `track`ed, `pull`ed or `push`ed.

## Acceptance criteria

- [x] `configured` is `true` with a `.gitattributes` containing `filter=lfs` (also nested) and `false` without it or if it only appears commented out.
- [x] The File status warning appears only if `configured && !installed`; the sidebar section, whenever `configured`.
- [x] Pointer detection works in unified and side-by-side patches and does not flag normal diffs.
- [x] Tests: `.gitattributes` and NUL listing parsers, `lfs_status` integration, store and components.

## Out of scope

- `git lfs install/track/pull/push/fetch`, smudge/clean and object download.
- Showing the remote content of the file or its real diff.
- LFS progress bar or cache.

## Technical notes

- `git lfs version` exits with code 1 when git-lfs is not there; it is interpreted as "not installed" without propagating the error.
- `.gitattributes` is located with `git ls-files -z` filtering names ending in `.gitattributes` and read from the working tree: only tracked ones count.
- The pointer detector ignores diff prefixes (`+`/`-`/space) and requires `version https://git-lfs.github.com/spec/v1`, `oid sha256:<64 hex>` and `size <n>`.
- `LfsStatus` lives in the `extras` store next to submodules and worktrees; it is refreshed with the watcher and with `mod+R`.

## Implementation notes (2026-09-18)

- Rust: `LfsStatus`; `parse_gitattributes_paths` and `parse_gitattributes_uses_lfs` (comments excluded; exact token `filter=lfs`); `lfs_status` tolerates `git lfs version` failing.
- In the integration tests no files matching `filter=lfs` are added: without git-lfs installed, `git add` tries to run the filter and fails (precisely the scenario the UI warns about). On this machine git-lfs is not installed and the warning is visible from the first launch.
- Frontend: `parseLfsPointerPatch` detects version/oid/size ignoring diff prefixes; warning in File status (only if git-lfs is missing) and in the diff (whenever the patch is a pointer); Git LFS section in the sidebar.
- Tests: 109 Rust (2 parser and 3 integration new), 179 frontend (10 new).
- Closed on 2026-09-18 with green CI (Frontend 41 s, Rust 1m27s) in PR #21.
