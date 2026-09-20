# ADR-0010 · Run blocking work off the main thread

- **Status:** accepted
- **Date:** 2026-09-22
- **Deciders:** Raúl López

## Context

Tauri 2 runs every **non-async** command on the application's main thread. On
Linux that thread is the GTK event loop, so a command that spawns git blocks
painting and input. Switching repository tabs freezes the UI on Ubuntu: each tab
open runs `git log`, `for-each-ref` and `status`, and every one of them executed
on the main thread.

The watcher compounded it. `watch::start` ran `git ls-files` to build the ignore
set and only returned once the OS watch was registered, all on the command
thread. Registering a recursive watch is cheap on macOS (a single FSEvents
stream) but O(directories) on Linux inotify, so the same code that is invisible
on macOS made the freeze worse on Linux.

## Decision

Run every command that spawns git or does blocking IO as an **`async` command
whose body is dispatched with `tauri::async_runtime::spawn_blocking`**. Commands
without state use a `blocking` helper; commands that need the shared `AppState`
use a `blocking_state` helper that resolves the state from an `AppHandle`
**inside** the blocking task, so no `State` borrow crosses the await. Command
names, argument names and return shapes stay unchanged, so the frontend is
untouched.

Commands that only touch the GUI thread (window creation, the native menu) and
the trivial in-memory commands stay synchronous. `watch::start` becomes
infallible and non-blocking: it registers the OS watch on a worker thread and
exposes `WatcherHandle::wait_ready` for callers that need to know the watch is
live. The `watchers` mutex is held only to swap the handle; stopping a watcher
happens outside the lock and, on swap, detached.

## Alternatives considered

- **A dedicated worker queue per repository** — serializes git commands and
  gives deterministic ordering, but adds a queue, a scheduler and back-pressure
  to every call site. `spawn_blocking` reuses the runtime's pool and is a
  one-line change per command.
- **Clone the `Runner` into a scoped thread per call** — avoids `AppState`
  lifetime questions, but duplicates thread management, bypasses the runtime's
  pooling and still needs the same readiness handshake for the watcher.
- **Only make `open_repo` async** — fixes the observed freeze for tab opening
  but leaves every other git call on the main thread, so a slow `status` or
  `log` would still stutter.

## Consequences

- The UI stays responsive while git runs: tab switching no longer blocks the
  GTK thread, and the watcher's ignore load does not delay the command.
- Commands now run **concurrently** on the blocking pool. Two git writes to the
  same repository can contend for git's own locks (`index.lock`); the runner
  already surfaces that as a typed error, but it is a behaviour to watch. This
  is a known, accepted risk, not a defect.
- `open_repo` can return before the OS watch is registered, so a change made in
  the milliseconds after opening may not produce an event. The frontend already
  reloads on open, and `wait_ready` is available where the guarantee is needed
  (tests).
- The `WatcherHandle` carries a `Readiness` and a `stop_detached` method;
  `lib.rs` uses the latter on `WindowEvent::Destroyed`.
- Because `open_repo` now yields between opening the repo and installing the
  watcher, a per-window generation counter (`AppState::watcher_epoch`) marks an
  in-flight open as superseded when the window is closed or another open starts;
  the stale attempt stops its watcher instead of installing it, so no watch or
  thread is leaked.
- If command ordering ever becomes a correctness requirement, revisit this ADR
  with a per-repository queue.
