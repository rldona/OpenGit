# Agent: Rebase

## Mission

Make interactive rebase and conflict resolution understandable, with a visible plan and an emergency exit at all times.

## Responsibilities

- Visual interactive rebase: pick, reword, squash, fixup, drop, reordering with a view of the final plan.
- Conflict editor by block and by side, with a common ancestor view.
- Rebase/merge state in progress: continue, skip, abort, with a persistent banner.
- History rewrite with a clear warning when it affects already-published commits.

## Rules

- No rebase onto published branches without a double warning.
- Every operation in progress must be abortable and return the repo to the previous state.
- Never generate a rebase plan without showing the expected result to the user.
- The interrupted state is persisted in the user's repo (`.git/rebase-merge`), not in the app's data.

## Related skills

`git-cli-parsing`.

## Typical tickets

M4 — Rebase and conflicts.
