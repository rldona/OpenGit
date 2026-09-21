# OG-101 · Stabilize the watcher ignore test

- **Milestone:** Next (post-M18)
- **Status:** done
- **Depends on:** OG-080
- **References:** `src-tauri/tests/watch.rs`

## Context

`ignores_changes_inside_gitignored_directories` failed once on `main` (run
`35536303236`) and passed on re-run. The watcher can deliver an event buffered
before the watch settled, and the test read it as an ignored change, so the
assertion is not deterministic.

## Scope

- Drain events buffered right after the watcher starts (a short settle plus a
  drain) before writing the ignored file.

## Acceptance criteria

- [x] The test is deterministic across repeated runs.
- [x] `cargo test`, `cargo clippy -D warnings` and `cargo fmt --check` green.

## Out of scope

- Changing the watcher's ignore logic (it is correct).

## Implementation notes (2026-09-20)

- After `start`, sleep briefly and drain the channel so a setup event cannot be
  mistaken for a change to the ignored directory; then write the ignored file
  and assert no `WorktreeChanged`.
