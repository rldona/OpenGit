# OpenGit architecture

## Overview

```
┌──────────────────────────────────────────────────────────┐
│ React UI (WebView)                                       │
│  Sidebar · Graph/Log · Diff · Staging · Output panel     │
└──────────────▲───────────────────────────────────────────┘
               │ invoke(cmd, args) / events (Tauri IPC)
┌──────────────┴───────────────────────────────────────────┐
│ Rust core (src-tauri)                                    │
│  commands · parsers · repo watcher · cancellable jobs    │
└──────────────▲───────────────────────────────────────────┘
               │ spawn(argv, no shell)
┌──────────────┴───────────────────────────────────────────┐
│ system git binary                                        │
└──────────────────────────────────────────────────────────┘
```

Guiding principle: **the UI does not know git**. It only paints models and
issues commands. Every interaction with the repository happens in Rust.

## Components

### Frontend (`src/`)

- **Views:** graph/log, commit detail, diff (working/staged/commit), staging
  panel, sidebar (branches, tags, remotes, stashes), output panel.
- **State:** per-repository store (open repo, refs, loaded commits, status,
  selection) and global store (recents, preferences, theme). The library
  decision is made in OG-001.
- **Bridge:** thin layer over `invoke` and `listen` with hand-written types at
  first; models are shared with Rust through TypeScript types.
- **No git business rules:** no command is built in the UI; named operations
  with parameters validated in Rust are requested instead.

### Rust core (`src-tauri/`)

- **Tauri commands:** public API for the UI (`open_repo`, `log_page`, `diff`,
  `stage_hunk`, `commit`, `checkout`, `fetch`, `push`...).
- **Threading:** every command that runs git or blocking IO is `async` and
  dispatches its work to the runtime's blocking pool, so the GTK/UI thread is
  never blocked; only GUI-thread commands (window/menu creation) and trivial
  in-memory commands stay synchronous (ADR-0010).
- **Git runner:** spawns processes with argument arrays, a controlled
  environment, timeout and cancellation; returns `stdout`/`stderr`/exit code.
- **Parsers:** pure functions per command (`-z` / `--porcelain=v2` /
  `--format`), covered with fixtures. They never parse localized or "human"
  output.
- **Watcher:** observes `.git` (HEAD, refs, index, MERGE_HEAD...) with
  debounce and emits "repo changed" events to the UI.
- **Errors:** typed enum (`GitError`) with a UI message, exit code and stderr;
  the UI decides how to present it.

### Refresh model

```
fs event in .git ──watch──► debounce (250 ms) ──► invalidate state
                                                     │
UI asks for data ──invoke──► Rust runs git ──► parses ──► responds
                                                     │
progress events (fetch/pull/push) ──listen──────────► output panel
```

- No polling: watch + debounce. While the app itself runs operations, the
  watcher is paused to avoid event storms.
- Long operations (fetch, pull, push, big checkout) emit progress events and
  are cancellable.

## Minimal data model

| Model | Git source | Notes |
| --- | --- | --- |
| `Commit` | `git log --format=... -z` | hash, parents, author, date, refs, subject |
| `FileStatus` | `git status --porcelain=v2 -z` | index vs HEAD vs working tree |
| `FileDiff` | `git diff -z` + `--numstat` | hunks, binaries, renames |
| `Ref` | `git for-each-ref --format=... -z` | locals, remotes, tags |
| `Stash` | `git stash list --format=... -z` | message, date, base |

## Performance

- **Goal:** open a 10,000-commit repository with first paint < 500 ms and
  smooth scrolling (see `ROADMAP.md` M1).
- Paginated history and incremental lane layout (ADR-0004).
- Virtualized rows; the canvas only draws the viewport.
- `git status` is the most frequent query: cache it and refresh only on
  watcher changes.
- Error budget: the UI never shows an endless spinner; every command has a
  timeout and an explicit error state.

## Security

- Execution with a separate `argv`; `sh -c` and interpolating user input are
  **forbidden**.
- Paths and refs are validated and passed as arguments, never concatenated.
- `GIT_TERMINAL_PROMPT=0`: missing credentials fail with a clear error
  instead of hanging. Credentials are handled by the system credential helper
  (ADR-0003).
- No telemetry and no network of our own: only whatever the user's git does.
