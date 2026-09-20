# OG-033 · `--skip` in rebase and cherry-pick

- **Milestone:** M5 — Polish (v2 of OG-019)
- **Status:** done
- **Depends on:** OG-019, OG-021
- **References:** ROADMAP.md

## Context

The operations banner (OG-019) allows Abort and Continue, but not **skipping** the conflicting commit. In a rebase or cherry-pick with awkward conflicts, the only way out is to resolve or abort.

## Scope

- Backend: `repo_op_skip` runs `--skip` on the active operation (rebase, cherry-pick or revert), with `GIT_EDITOR=true`.
  - `merge` has no `--skip` in git: clear error indicating that it must be resolved or aborted.
  - No operation in progress: error.
- UI: **Skip** button in the banner, visible only if the operation is not a merge.
- After the skip, state, status, refs, history and `op_state` are refreshed, as in Abort/Continue.

## Acceptance criteria

- [x] A cherry-pick in conflict + Skip leaves the repo clean and without that commit applied.
- [x] A rebase in conflict + Skip continues with the rest of the plan.
- [x] A merge in conflict + Skip fails with a clear message and does not touch the repo.
- [x] Without an operation, Skip fails.
- [x] Tests: Rust integration, store and banner.

## Out of scope

- `--quit`, selective skip of commits inside a rebase or rewording the message when skipping.
- Skip in merge (it does not exist in git).

## Technical notes

- `git cherry-pick --skip` and `git revert --skip` exist since git 2.20; `git rebase --skip` is older. The project minimum (2.34) covers both.
- The verb name (`rebase`, `cherry-pick`, `revert`) comes from `RepoOpState::operation()`, the same one used by abort and continue.

## Implementation notes (2026-09-18)

- Rust: `repo_op_skip` rejects `merge` with `merge has no skip: resolve the conflicts or abort`; the `repo_op_skip` command is registered alongside abort/continue.
- UI: **Skip** button in the banner only when the operation is not merge; the `commit` store adds `skipOp` with the same refresh as abort/continue and output "Operation skipped".
- Tests: 117 Rust (3 integration) and 202 frontend (2 banner and 1 store).
- Closed on 2026-09-18 with green CI (Frontend 40 s, Rust 1m54s) in PR #30.
