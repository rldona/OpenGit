# OG-073 · Fix submodule test env race in CI

- **Milestone:** Next (post-M8)
- **Status:** done
- **Depends on:** OG-057
- **References:** `src-tauri/tests/submodules_worktrees.rs`, `src-tauri/tests/support/mod.rs`

## Context

CI (Rust job) flakes in `submodules_worktrees`:
`adding_a_submodule_validates_url_and_path` fails in `TestRepo::init`
with `git ["init", "-b", "main", "-q"] failed: error: missing config
value GIT_CONFIG_VALUE_0`.

Root cause: `manages_submodules_add_init_and_sync` enables the file
protocol via three process-global `set_var` calls
(`GIT_CONFIG_COUNT/KEY_0/VALUE_0`). Rust integration tests share one
process with threads in parallel, and the trio is not atomic: a `git`
spawn on another thread landing between `COUNT=1` and `VALUE_0=always`
observes the count without its value, which git rejects. Locally the
window is nanoseconds; on loaded CI runners it hits.

## Scope

- Set the trio so no partial state is observable: `KEY_0`, `VALUE_0`
  first, `COUNT` last (without `COUNT`, git ignores the rest).
- Unset in reverse order at the end of the test for the same reason.
- No behavior change in the app (which deliberately does not force the
  file protocol) or in the other tests.

## Acceptance criteria

- [x] `cargo test --test submodules_worktrees` passes repeatedly under
  stress locally.
- [x] `cargo clippy --all-targets -- -D warnings`,
  `cargo fmt --check` green; CI Rust job green on push.
- [x] No new dependencies.

## Out of scope

- Serializing tests with a mutex or external crates.
- Forcing `protocol.file.allow` in the app.

## Implementation notes (2026-09-19)

- `manages_submodules_add_init_and_sync` sets `KEY_0`/`VALUE_0` before
  `COUNT`, and unsets in reverse at the end; without `COUNT` git ignores
  the rest, so no partial trio is ever observable.
- Diagnosis proven by widening the window with sleeps on the original
  order: same `missing config key/value` failures in
  `adding_a_submodule_validates_url_and_path` and siblings (experiment
  reverted, only the ordering fix committed).
- Verified: 15/15 local stress runs green, `clippy --all-targets
  -D warnings`, `cargo fmt --check` green. (The earlier Frontend failure
  on the OG-071 push was an unused `user` binding, already fixed in
  OG-072's branch and green since.)
