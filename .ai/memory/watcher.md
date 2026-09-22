# `.git` watcher

## Debounce by type and pause during our own operations

- **Date:** 2026-09-18
- **Context:** OG-010; refresh storms and loops with the app's own writes had to be avoided.
- **Design:**
  - `notify` watches `.git` in recursive mode; access events (`EventKind::Access`) are discarded so as not to react to our own reads.
  - Events accumulate in a per-type mask and are emitted after 250 ms with no news: ten consecutive `git add`s produce a single `repo://index-changed`.
  - The pause is an atomic counter: write commands pause, execute and resume; if there were changes, on resume a single `repo://refreshed` is emitted.
  - If `notify` can't start (containers, network volumes), it falls back to 5 s polling.
- **Implication:** any new command that writes to the repo must be wrapped in `pause_while`; and bulk reads must keep using `GIT_OPTIONAL_LOCKS=0` so as not to touch the index. On macOS FSEvents arrive at directory level: classify by file name, don't assume exact paths.

## Watching the working tree: canonical paths and one recursive root

- **Date:** 2026-09-20
- **Context:** OG-080. The status list did not react to external edits because only `.git` was watched. The fix watches the working tree too, filtering git-ignored paths.
- **Findings:**
  - macOS FSEvents reports **real** paths: a repo under `/var/folders/…` arrives as `/private/var/folders/…`. Prefix checks (`path.starts_with(git_dir)`, the ignore set) fail unless `repo_root` is canonicalized first. `start` canonicalizes once and derives everything from it.
  - `notify`'s macOS backend keeps a single `FSEventStream`; every call to `watch()` appends a root and **restarts the stream**, and every event scans all roots (`recursive_info`). One root per directory would be O(dirs) per event plus a restart per directory, so we watch a single recursive root and filter per event.
  - The ignore set comes from `git ls-files -o -i --exclude-standard --directory -z`; `--directory` collapses fully ignored directories at any depth, so an ancestor-walk lookup covers descendants. A directory that does not exist yet is not listed, so the set is rebuilt while worktree changes keep arriving (throttled) and when a `.gitignore` is edited.
- **Implication:** do not add per-directory `watch()` calls; keep the single root and the event filter. Any path math in the watcher must start from the canonical root.

## `start` returns before the OS watch is registered

- **Date:** 2026-09-22
- **Context:** OG-109. `start` ran `git ls-files` for the ignore set and waited for the OS watch on the command thread, which is the GTK thread on Linux; registering a recursive watch is O(directories) with inotify.
- **Design:** `start` is now infallible and non-blocking. It creates an empty `IgnoreMatcher` (no git), registers the notify watch, loads the ignore set, and signals a `Readiness` condvar exposed as `WatcherHandle::wait_ready(timeout)`. The polling fallback sleeps in 100 ms chunks so `stop` is noticed promptly, and `stop_detached` joins the thread off the caller's thread.
- **Implication:** do not assume events arrive right after `start`; use `wait_ready` in tests and wherever the "watch is live" guarantee matters. A swap of watchers must not hold the `watchers` mutex while stopping the previous handle.
