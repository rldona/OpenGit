# OG-092 · Revert a merge commit with a mainline

- **Milestone:** M17 — Recovery and debugging
- **Status:** done
- **Depends on:** OG-017
- **References:** `src-tauri/src/git/`, `src/components/HistoryView.tsx`

## Context

Reverting a merge commit needs `-m <parent>`; without it git refuses. The
revert action (OG-017) does not offer the parent choice, so merges cannot be
reverted from the app.

## Scope

- Detect when the selected commit is a merge (more than one parent) and ask
  which parent is the mainline (usually the first).
- Pass `-m <n>` to the revert command; keep the existing conflict flow.

## Acceptance criteria

- [x] Reverting a normal commit is unchanged.
- [x] Reverting a merge asks for the mainline and runs `-m`.
- [x] Conflicts land in the existing conflict editor.
- [x] Tests with a temporary repository that has a merge commit.
- [x] Checks green.

## Out of scope

- Reverting a range of commits.
- Interactive mainline editing beyond the parent list.

## Technical notes

- Parents are available from the commit already loaded in the log; no extra git
  call is needed if the model keeps them.

## Implementation notes (2026-09-20)

- Rust: `revert_commit` takes an optional `mainline` and adds `-m <n>` (a value
  of 0 is rejected); the command passes it through.
- Frontend: when the commit is a merge (more than one parent), the context menu
  offers **Revert (mainline N)** per parent instead of a single Revert; the
  confirmation names the mainline.
- Tests: an integration test reverts a real merge with mainline 1 and checks
  that git refuses without `-m`.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (70 files, 519
  tests), `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check`.
