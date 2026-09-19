# OG-072 · Live worktree file list on watcher events

- **Milestone:** Next (post-M8)
- **Status:** done
- **Depends on:** OG-010
- **References:** `src/lib/stores/diff.ts`, `src/lib/hooks/useRepoEvents.ts`, `src/lib/refresh.ts`

## Context

With uncommitted changes, the Commit badge (22) and the "Uncommitted
changes" file list (8) disagree, and the list lags behind instead of
updating in real time.

Root cause: two stores, two refresh paths. The badge reads
`status.report.entries.length`, refreshed on every watcher event. The file
list reads `diff.files`, built once per `openWorktree` (mount/repo switch)
and never refreshed by watcher events, the Refresh button, or in-app
stage/unstage — so it freezes while the badge keeps moving.

## Scope

- New silent `useDiffStore.refreshWorktree(root)`: rebuilds the worktree
  file list preserving the selection (re-fetching its patch), sharing the
  `openToken` guard and file builder with `openWorktree`, without the
  loading flash.
- Watcher index/worktree events refresh status and the diff list together.
- `refreshRepo` (Refresh button, menu, ref events) includes the diff list
  refresh.
- No change to the badge semantics: it counts status entries, while file
  rows can exceed entries (staged + unstaged sides of one file).

## Acceptance criteria

- [x] Editing/saving files updates the badge and the file list together
  within the watcher latency.
- [x] The selected file stays selected across refreshes; its patch
  re-renders with the new content.
- [x] A file that stops changing disappears from the list without manual
  refresh.
- [x] `npm run typecheck`, `npm run lint`, `npm test` green.

## Out of scope

- Changing the badge to count diff rows.
- Watcher debounce tuning (250 ms stays).
- Per-tab cached state.

## Technical notes

- `refreshWorktree` no-ops unless the diff target is worktree for the same
  root. `openWorktree` keeps its "select first file" behavior.

## Implementation notes (2026-09-19)

- Extracted `buildWorktreeFiles` shared by `openWorktree` (select first)
  and the new silent `refreshWorktree` (keep selection by key, re-fetch
  its patch, fall back to first/clear); same `openToken` guard, no
  loading flash.
- `useRepoEvents` index/worktree events now refresh status + diff list;
  `refreshRepo` includes the diff refresh (Refresh button fixes the list
  too).
- Tests: 3 new `refreshWorktree` store cases (keep selection + patch
  re-fetch, fallback when gone, no-op outside worktree target);
  `refresh.test.ts` asserts the new call.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (55 files,
  439 tests) green.
