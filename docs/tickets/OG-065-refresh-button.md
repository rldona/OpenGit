# OG-065 · Refresh button: include stashes and give feedback

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** ready
- **Depends on:** OG-010, OG-050
- **References:** ROADMAP.md

## Context

The toolbar Refresh button calls `refreshAll` (`src/App.tsx`), which reloads
the log, status, refs and extras from git. Two issues make it feel like a
no-op:

- It **skips stashes**, while the git watcher does reload them
  (`useRepoEvents`). After pressing Refresh the stash list can be stale.
- It gives **no feedback at all**: no Output line, no busy state, nothing
  changes visibly. Because the watcher already auto-refreshes on repository
  changes, the button looks dead.

SourceTree's Refresh does reload everything and gives a sign that it ran.

## Scope

- Refresh reloads the same set in every path: log, status, refs, extras and
  stashes.
- Give feedback when the button is pressed:
  - append a line to the Output panel (for example `Refreshed <repo>`), and/or
  - show the button busy/disabled until the reloads settle.
- Single source of truth: the Refresh button (and the native menu's Refresh)
  should reuse the same helper the watcher's `onRefreshed` path uses, so the
  five stores cannot drift apart again.

## Acceptance criteria

- [ ] Refresh reloads log, status, refs, extras and stashes.
- [ ] Pressing Refresh gives visible feedback (Output line and/or busy button).
- [ ] The button path and the watcher path share one refresh helper.
- [ ] Tests cover that stashes are refreshed and that feedback appears.

## Out of scope

- Forcing the Rust watcher to rescan from the UI: refresh is a frontend reload
  of the five stores. A `repo://refreshed` request/command can be a follow-up
  if the watcher ever misses changes.
- Progress reporting per store; the reloads are local git reads.

## Technical notes

- Today `refreshAll` lives inline in `App.tsx` and is fire-and-forget
  (`void ...`). To drive a busy state it has to return a `Promise.all` of the
  store refreshes.
- `useRepoEvents.onRefreshed` already reloads the five stores but duplicates
  the list; moving both to a shared `refreshRepo(root)` avoids the current
  mismatch (the watcher includes stashes, the button does not).
