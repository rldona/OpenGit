# OG-080 · Watch the working tree so external edits show up live

- **Milestone:** M13 — Live working tree
- **Status:** done
- **Depends on:** OG-009, OG-010, OG-072
- **References:** `src-tauri/src/watch/mod.rs`, `src-tauri/src/commands.rs`, `src/lib/hooks/useRepoEvents.ts`

## Context

The "Uncommitted changes" list only updates when something writes into
`.git`. OG-010 watches `<repo>/.git` recursively and deliberately left the
working tree out of scope ("high cost on large repos").

As a result, editing or creating a file with an external editor does not
touch `.git`, so no event is emitted and the list stays stale until the user
presses the Refresh button or `mod+r`, or until some git command writes the
index. SourceTree watches the working tree, so its file status updates as
the user saves.

## Scope

- Watch the working tree recursively. `.git` lives inside the same root, so
  a single watch covers both; `classify_path` keeps the `.git`-specific
  event rules.
- Filter out paths ignored by git (`.gitignore`, `info/exclude`) so build
  directories (`node_modules`, `target`, `dist`, …) do not cause refresh
  storms.
- Route working-tree events to the existing `repo://worktree-changed`
  event: the UI already refreshes status and the file list for it
  (OG-072), so no frontend change is expected.
- Refresh the ignore filter when a `.gitignore` is edited.
- Keep the 250 ms debounce, the pause during the app's own operations and
  the polling fallback.

## Acceptance criteria

- [x] Saving a tracked or untracked file (without any git command) emits
  `repo://worktree-changed` within the watcher latency.
- [x] Changes inside an ignored directory do not emit worktree events.
- [x] `.git` events keep working exactly as before (commit, checkout, …).
- [x] No duplicate refresh storms while the app runs its own operations.
- [x] `cargo test`, `cargo clippy`, `cargo fmt --check` green.

## Out of scope

- Pruning the OS-level watch set directory by directory (notify adds one
  recursive root; filtering is done per event).
- Linked worktrees whose real git dir lives outside the root: only the
  `.git` file inside the root is seen, as before.
- File search index.

## Technical notes

- `notify`'s macOS backend keeps a single FSEvents stream whose roots share
  one `recursive_info` map, and every event scans that map. Adding one root
  per directory would be O(number of dirs) per event and restart the stream
  on every `watch()` call, so a single recursive root plus in-memory
  filtering is preferred.
- The ignore set is computed with `git ls-files -o -i --exclude-standard
  --directory -z` and checked by ancestor walk, so both ignored files and
  descendants of ignored directories are filtered with O(depth) lookups.
- `Runner` is passed to `watch::start` to (re)build the filter.

## Implementation notes (2026-09-20)

- `watch::start` now takes the `Runner`, canonicalizes `repo_root` and
  watches a single recursive root; `classify_path` sends `.git` paths to the
  old `classify` and drops git-ignored working-tree paths, everything else
  is `WorktreeChanged`.
- `IgnoreMatcher` loads the ignored set with `git ls-files -o -i
  --exclude-standard --directory -z` and answers by ancestor walk. It is
  rebuilt on `.gitignore`/`exclude` edits and, throttled to 2 s, while
  worktree changes keep arriving (for directories created after start).
- `start` blocks until the OS watch is registered, which made the
  integration tests deterministic.
- Tests: unit cases for `classify_path`, `IgnoreMatcher` and the existing
  grouping/pause cases; integration cases for external edits and ignored
  directories. `cargo test`, `cargo clippy -D warnings`, `cargo fmt
  --check`, `npm run lint`, `npm run typecheck`, `npm run format:check`
  and `npm test` (60 files, 469 tests) green.
