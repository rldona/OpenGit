# OG-115 · Replace the deprecated `fetch_update` with `try_update`

- **Milestone:** Next
- **Status:** done
- **Depends on:** —
- **References:** `src-tauri/src/watch/mod.rs`, `.github/workflows/ci.yml`

## Context

CI installs the `stable` Rust toolchain. Current stable deprecates
`AtomicUsize::fetch_update` in favour of `try_update`, and clippy runs with
`-D warnings`, so the Rust job fails on every PR regardless of its content.

## Scope

- `WatcherHandle::resume` calls `try_update` instead of `fetch_update`.

## Acceptance criteria

- [x] `cargo clippy --all-targets -- -D warnings` is clean.
- [x] `cargo test` is green.

## Out of scope

- Pinning the toolchain.
