# OG-049 · Branch merge

- **Milestone:** M7 — SourceTree parity (phase 2)
- **Status:** done
- **Depends on:** OG-019, OG-020
- **References:** ROADMAP.md, OG-041

## Context

OpenGit knows how to detect an in-progress merge and abort or continue it (OG-019), and resolve its conflicts (OG-020), but it **does not know how to start one**: there is no `merge` command either in `commands.rs` or in `git/mod.rs`. It came up when building the top toolbar (OG-041), which envisioned a Merge button with no backend behind it.

It is the last basic operation of the daily cycle that is missing.

## Scope

- Rust command `merge_branch(path, rev, no_ff)` that runs `git merge` with argv.
- Modes: fast-forward when possible and optional `--no-ff` to force a merge commit.
- Selection of the branch to merge from the toolbar and from the context menu of a branch in the sidebar ("Merge into <current branch>").
- Explicit confirmation before running, indicating what is merged and into what.
- A merge with conflicts must end in the flow that already exists: in-progress operation banner (OG-019) and conflict editor (OG-020), not in a loose error.
- Merge output to the Output panel.

## Acceptance criteria

- [x] Merging a branch without conflicts creates the merge and refreshes log, status and refs.
- [x] With `--no-ff` a merge commit is created even if fast-forward was possible.
- [x] A merge with conflicts leaves the repo in "merging" state, with the banner and the conflicting files listed.
- [x] Aborting from the banner leaves the tree as it was.
- [x] Merging a branch into itself or with no changes is communicated without looking like an error.
- [x] Integration tests with a temporary repo: fast-forward, no-ff, conflict and abort.

## Out of scope

- Merge strategies (`-X ours/theirs`, `--squash`).
- Merging more than one branch at a time (octopus).
- Automatic conflict resolution.

## Technical notes

- `git merge` returns a non-zero code also when there are conflicts, which **is not** a failure: `merge_branch` looks at `MERGE_HEAD` (`repo_op_state`) and only treats conflict-free failures as errors.
- Detection of an in-progress operation already exists (`repo_op_state`); the `useMergeBranch` hook reloads `commit.opState` so that the OG-019 banner appears and, if there is a conflict, opens the conflicts view.
- Rule 1 of AGENTS.md: explicit confirmation before running (Merge dialog or confirm when merging from the sidebar).
