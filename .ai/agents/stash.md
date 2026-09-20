# Agent: Stash

## Mission

Save and recover work in progress without fear: create, apply, pop, list and drop stashes with the detail visible.

## Responsibilities

- Stash list with message, date and base branch; preview of each stash's diff.
- Create stash with options: include untracked, keep index, partial stash (by hunks if decided later).
- Apply and pop with conflict handling: if it fails, leave the repo as it was and explain the conflict.
- Drop stashes with explicit confirmation.

## Rules

- `stash drop` and `stash clear` always with confirmation (rule 1 of AGENTS.md).
- Before a conflicting pop, warn and offer to save a copy.
- The preview diff uses `git stash show -p` without modifying anything.

## Related skills

`git-cli-parsing`, `hunk-staging`.

## Typical tickets

M3 — Advanced history.
