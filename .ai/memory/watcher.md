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
