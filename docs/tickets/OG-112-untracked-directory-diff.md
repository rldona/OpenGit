# OG-112 · Do not diff untracked directories as files

- **Milestone:** Next
- **Status:** done
- **Depends on:** OG-071
- **References:** OG-071, `src-tauri/src/git/mod.rs` (`untracked_file_diff`)

## Context

Selecting an untracked entry that is a directory (e.g. a nested git repository or
a worktree such as `.claude/worktrees/agent-*/`) shows
`git failed with code 1: error: Could not access '<dir>/null'`.
`untracked_file_diff` runs `git diff --no-index -- /dev/null <path>`. When the
second path is a directory, git appends the basename of `/dev/null` to it and
tries to read `<dir>/null`, which does not exist.

## Scope

- Detect untracked entries that are directories (trailing `/` in status or
  `is_dir` on disk) and skip `diff --no-index` for them.
- The UI shows an explicit "Untracked directory / nested repository" state instead
  of an error. For plain directories, list their files if cheap.
- The frontend does not invoke `untracked_file_diff` for those entries.

## Acceptance criteria

- [x] Selecting an untracked nested repo or directory shows no git error.
- [x] Untracked regular files still produce the new-file patch.
- [x] Rust test with a temporary repo containing an untracked directory and a
      nested repo; Vitest test for the UI state.
- [x] `npm run lint`, `npm run typecheck`, `npm run test`, `cargo test`,
      `cargo clippy -- -D warnings` are green.

## Out of scope

- Staging nested repositories as submodules.
