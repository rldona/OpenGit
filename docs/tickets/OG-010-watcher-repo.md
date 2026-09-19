# OG-010 · `.git` watcher and refresh

- **Milestone:** M1 — Local MVP
- **Status:** done
- **Depends on:** OG-003
- **References:** docs/architecture/overview.md, OG-009

## Context

The repo state changes by the app and from outside (terminal, IDE, hooks). The UI must reflect it without polling and without reload storms.

## Scope

- Watch `.git`: `HEAD`, `refs/`, `index`, `MERGE_HEAD`, `ORIG_HEAD`, `packed-refs`.
- 250 ms debounce and grouping of events by type (refs, index, working tree).
- Pause of the watcher during operations launched by the app and resumption with a single refresh at the end.
- Typed events to the UI: `repo://refs-changed`, `repo://index-changed`, `repo://worktree-changed`.
- Fallback by slow polling (e.g. 5 s) if the OS does not deliver events (containers, network volumes).

## Acceptance criteria

- [x] A commit from the terminal is reflected in < 1 s without touching the UI. _(refs/index event with debounce; integration test with a real repo)_
- [x] Ten consecutive changes in the index produce a single refresh. _(accumulator by type + 250 ms window; unit test)_
- [x] A long app operation does not trigger refreshes during its execution. _(pause/resume; unit and integration)_
- [x] The watcher stops when closing the repo or changing repo (no thread leaks). _(`close_repo` and stopping the previous one in `open_repo`)_
- [x] There are no loops: the refresh itself does not trigger events again. _(access events ignored, `GIT_OPTIONAL_LOCKS=0` on reads and pause on writes)_

## Out of scope

- Watching the whole working tree (high cost on large repos); the status refresh is decided by `.git` events and by explicit actions.
- File search index.

## Technical notes

- Recommended crate: `notify` + `notify-debouncer-mini`. Only `notify` is used and the debounce is implemented with a 250 ms window in the watcher thread.
- On macOS, `FSEvents` gives directory-level events; do not assume path per file.
- During `fetch/pull/push` the watcher is also paused so as not to react to `FETCH_HEAD`.

## Implementation notes (2026-09-18)

- `src/watch/mod.rs`: `notify` with recursive mode over `.git`, path classification (`index`, `refs/**`, `HEAD`/`packed-refs`/`ORIG_HEAD`/`MERGE_HEAD`/…), discarding of access events (anti-loops) and accumulator by type for grouping. Fallback to 5 s polling if the watcher cannot be created.
- Pause: atomic counter; write commands (`stage`, `unstage`, `discard`, `delete_untracked`) pause the watcher and on resuming emit a single `repo://refreshed`.
- The UI (`useRepoEvents`) listens to the four events: refs and refresh reload the history (silent, preserves selection and filter); index and worktree refresh the status.
- On closing the repo (Close button) or opening another, the previous watcher stops and the thread is freed.
- New dependency justified by the ticket: `notify` 8.2.
- Closed on 2026-09-18 with green CI (Frontend 20 s, Rust 1m39s) in PR #5, together with OG-009.
