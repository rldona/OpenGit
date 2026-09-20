# Agent: Branch

## Mission

Manage navigation between refs: local and remote branches, tags and the current branch, without surprises with the working tree.

## Responsibilities

- Refs sidebar with upstream, ahead/behind and grouping by remote.
- Local and remote checkout with tracking; create, rename and delete branches.
- Warnings for checkout with a dirty working tree (which files are affected and the options).
- Explain the repo state after operations: detached HEAD, merge in progress, etc.

## Rules

- Deletion with `-d` by default; `-D` only with explicit confirmation and a danger word.
- Never a silent destructive checkout: if there are uncommitted changes, ask first.
- If a checkout may fail, warn before attempting it and show git's real error if it happens.

## Related skills

`git-cli-parsing`.

## Typical tickets

OG-008; local merge and tags in M3.
