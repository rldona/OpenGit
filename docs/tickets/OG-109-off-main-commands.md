# OG-109 · Run blocking commands off the main thread

- **Milestone:** —
- **Status:** in-progress
- **Depends on:** OG-010, OG-080, OG-088
- **References:** ADR-0008, ADR-0010, `src-tauri/src/commands.rs`, `src-tauri/src/watch/mod.rs`, `src-tauri/src/lib.rs`

## Context

Tauri v2 runs every **non-async** command on the application's main thread. On
Linux that is the GTK thread, so a command that runs git blocks painting and
input. All 99 commands are sync and many of them spawn the git binary, which
freezes the window while switching repository tabs (opening a repo loads the
log, refs and status; each of those was a main-thread git call).

The watcher made it worse: `watch::start` ran `git ls-files` for the ignore set
and only returned after the OS watch was registered, all on the command thread.
On Linux inotify is O(directories), so registering the recursive watch is far
more expensive than FSEvents on macOS.

## Scope

- Move every command that runs git or does blocking IO off the main thread
  through `tauri::async_runtime::spawn_blocking`, without changing command
  names, argument names or return shapes (the frontend does not change).
- Keep GUI-thread-only commands synchronous: window creation
  (`open_repo_in_new_window`) and the native menu (`menu::set_menu_locale`),
  plus the trivial in-memory commands (`app_version`, `gitignore_templates`,
  `set_auto_refresh`, `initial_repo`, `cancel_remote_job`).
- Make `watch::start` infallible and non-blocking, with an explicit
  `wait_ready` for callers that need the OS watch registered.
- Stop the previous watcher without joining it on the command thread
  (`stop_detached`) and never hold the `watchers` mutex while stopping.
- Interrupt the polling fallback promptly on stop instead of sleeping a full
  5 s.

## Acceptance criteria

- [ ] Every git/blocking-IO command is `async` and runs its work on the
      blocking pool; command names, arguments and return types are unchanged.
- [ ] Commands that must stay on the main thread (window/menu creation) and
      the trivial in-memory commands remain synchronous.
- [ ] `open_repo` returns without waiting for the OS watch to be registered and
      without joining the previous watcher.
- [ ] `watch::start` returns immediately; `WatcherHandle::wait_ready` reports
      when the watch is registered.
- [ ] The watcher polling fallback reacts to stop within ~100 ms.
- [ ] `cargo clippy -- -D warnings`, `cargo test` and the frontend checks pass.

## Out of scope

- Any frontend change: command names, argument names and return shapes stay
  identical (`invoke` is already async).
- Serializing git commands against each other; concurrency is accepted as a
  known risk (ADR-0010).
- Reworking the watcher's ignore strategy or the debounce.

## Technical notes

- Helpers in `commands.rs`: `blocking` for state-less commands and
  `blocking_state` for commands that resolve `AppState` from an `AppHandle`
  inside the task. Both map a failed join to `GitError::Spawn`.
- `gpg_secret_keys` returns a plain list, not a `Result`, so it cannot use
  `blocking`; it calls `spawn_blocking` directly and degrades to an empty list
  on a failed join, matching gpg's own "no keys" behaviour.
- `open_repo`/`close_repo`/`start_remote_job` are converted by hand: they keep
  the window label or clone the `AppHandle` for emits.
- The `watchers` map is locked only to insert/remove the handle; the previous
  watcher is stopped outside the lock (`stop_detached` on swap, `stop` on
  close).
- `watch::start` now creates an empty `IgnoreMatcher` without git, registers
  the OS watch, then loads the ignore set, signalling readiness afterwards.
