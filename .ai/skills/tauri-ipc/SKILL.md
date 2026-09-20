---
name: tauri-ipc
description: Use when adding or changing communication between the React UI and the Rust core in Tauri 2 (commands, invoke, events, streaming progress, cancellation, error types). Triggers on invoke, tauri command, IPC, event, listen, emit, bridge, serialization. Covers naming, error shapes, async safety and payload limits.
---

# UI ↔ Rust bridge (Tauri 2)

## Commands

```rust
#[tauri::command]
async fn log_page(repo: String, skip: u32, limit: u32) -> Result<LogPage, GitError> { ... }
```

- Command names in `snake_case`; arguments in `camelCase` from TS (Tauri maps them).
- Return serializable types and **always** `Result<T, E>` with a typed `E` (`GitError`: kind, message, stderr, exit_code, retryable).
- No blocking: git operations are I/O; use `tauri::async_runtime::spawn_blocking` or jobs on dedicated threads. Never run git directly in the async handler.
- Long commands (fetch/pull/push) return a `job_id` immediately and emit progress via events.
- Explicit cancellation: `cancel_job(job_id)` command that kills the process and cleans up.

## Frontend

- A single bridge module (`src/lib/bridge/`) with one typed function per command. `invoke("...")` scattered through components is forbidden.
- TS types mirroring the Rust models in a single file; if they diverge, the bug is in the bridge.
- Events with domain names: `repo://refs-changed`, `job://progress`, `job://finished`.
- Subscription with `listen` inside a `useEffect` with cleanup; never duplicated listeners.
- Bridge errors are converted into a uniform object for the UI (toast, output panel or error state depending on the case).

## Payloads

- Always paginated: maximum commits/diffs per message. Don't serialize 100,000 commits.
- Large files are requested on click, not when loading the view.
- Prefer IDs and references over duplicating large structures between events.

## Anti-patterns

- `invoke` scattered through components.
- `async` handlers that do a blocking `Command::output()` without `spawn_blocking`.
- Events without a job or correlation (impossible to know which operation they belong to).
- Global state in Rust stored in a `Mutex` without Tauri's `State` or without cleanup when closing the repo.
- Returning a generic error `String`: the UI can't distinguish auth from non-fast-forward.
