# OG-009 · Working tree status

- **Milestone:** M1 — Local MVP
- **Status:** done
- **Depends on:** OG-003
- **References:** ADR-0003, OG-010

## Context

The status view (inspired by SourceTree's "File status") answers "what has changed" and allows moving between staged/unstaged/untracked.

## Scope

- Flat list of changes with per-file status: staged, unstaged, untracked, renamed, conflict.
- Sections: Staged / Unstaged / Untracked / Conflicts (if there are any).
- Stage/unstage/discard changes of a file from the list (discard with confirmation).
- Open the file diff when selecting it.
- Search/filter by name.
- Counters per section.

## Acceptance criteria

- [x] The listing reflects exactly `git status --porcelain=v2 -z`, including renames with score and unresolved conflicts. _(parser with fixtures + sections that separate conflicts)_
- [x] Discarding changes of a file asks for confirmation and does not affect the others. _(native confirmation dialog; `git restore` per file)_
- [x] Untracked can be added without going through the diff. _(direct Stage button)_
- [x] Files with non-ASCII names and with spaces are displayed and operated correctly. _(paths as arguments after `--`; non-ASCII fixtures)_
- [x] The list refreshes with the watcher without flickering or losing selection. _(silent refresh that preserves filter and selection; OG-010)_

## Out of scope

- `.gitignore` management from the UI.
- Adding a file to `.git/info/exclude`.

## Technical notes

- `FileStatus` model with `XY` from porcelain v2, `origPath` for renames and submodule flags.
- Do not parse `git status` output without `--porcelain=v2 -z` under any circumstances.

## Implementation notes (2026-09-18)

- Backend: commands `status_repo`, `stage_path`, `unstage_path`, `discard_path` and `delete_untracked`. The operations live in `src/repo/ops.rs` (`git add -A --`, `git restore --staged --`, `git restore --source=HEAD --staged --worktree --`) and go with `--` before the paths. Deleting untracked validates that the path is relative and without `..`.
- UI: `StatusView` with sections (Conflicts/Staged/Unstaged/Untracked), counters, name search and per-row actions; discard and delete use the native confirmation dialog (`dialog:allow-ask`).
- File selection ready for the diff viewer: the panel arrives with OG-005.
- Rust integration test that does stage → unstage → discard and checks the content on disk; frontend tests for sections, stage and confirmation.
- Closed on 2026-09-18 with green CI (Frontend 20 s, Rust 1m39s) in PR #5, together with OG-010.
