# OG-092 · Revert a merge commit with a mainline

- **Milestone:** M17 — Recovery and debugging
- **Status:** backlog
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

- [ ] Reverting a normal commit is unchanged.
- [ ] Reverting a merge asks for the mainline and runs `-m`.
- [ ] Conflicts land in the existing conflict editor.
- [ ] Tests with a temporary repository that has a merge commit.
- [ ] Checks green.

## Out of scope

- Reverting a range of commits.
- Interactive mainline editing beyond the parent list.

## Technical notes

- Parents are available from the commit already loaded in the log; no extra git
  call is needed if the model keeps them.
