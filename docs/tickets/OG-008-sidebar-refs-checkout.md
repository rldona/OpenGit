# OG-008 · Branches/tags sidebar and checkout

- **Milestone:** M1 — Local MVP
- **Status:** done
- **Depends on:** OG-003, OG-010
- **References:** docs/architecture/overview.md

## Context

The side panel is SourceTree's navigation pattern: local branches, remote branches, tags and stashes, with direct actions.

## Scope

- Tree of local branches with their upstream and ahead/behind; remote branches grouped by remote; sorted tags.
- Checkout of a local branch; checkout of a remote branch creating the local one with tracking.
- Create branch from a commit, rename and delete (with confirmation and without `-D` by default).
- Search/filter in the tree.
- Current branch indicator.

## Acceptance criteria

- [x] Checkout updates graph, status and sidebar after the watcher event. _(besides the watcher, the store refreshes log, status and refs when finished)_
- [x] Checkout with a dirty working tree shows a prior notice with the list of affected files and allows cancelling. _(notice with the number of changes and native confirmation; the detailed list remains in File status)_
- [x] Checkout of a remote creates the local one with `--track` and the correct default name. _(test: `origin/remota` → branch `remota` with upstream)_
- [x] Deleting an unmerged branch requires explicit confirmation with the danger word. _(the branch name is typed before using `-D`)_
- [x] Annotated and lightweight tags are distinguished. _(different marker depending on `object_type`)_

## Out of scope

- Remote management (add/edit URL).
- Fetch/pull/push (OG-011).
- Merge and rebase from the sidebar (M3/M4).

## Technical notes

- Refs with `git for-each-ref --format` (NUL) including `%(upstream)`, `%(upstream:track)` and `%(objecttype)`.
- Ahead/behind with `git rev-list --left-right --count` only for the current branch, not for the whole tree.
- Deletion uses `-d` first; `-D` only after explicit confirmation (rule 1 of AGENTS.md).

## Implementation notes (2026-09-18)

- Rust: `branch_tracking` (current branch, upstream and ahead/behind with `rev-list --left-right --count`), `checkout_ref` (with `--track`), `create_branch`, `rename_branch` and `delete_branch`; names are validated with `git check-ref-format --branch` before touching anything and writes pause the watcher.
- UI: `RefsSidebar` replaces the sidebar placeholders with Branches (current indicator, ahead/behind, create/rename/delete inline), Remotes grouped by remote and Tags (annotated vs lightweight). Single filter for the whole tree and confirmation by name for `-D`.
- Checkout warns if there are uncommitted changes and allows cancelling; when finished it refreshes refs, status and graph.
- Tests: 6 Rust (ahead/behind tracking, local and remote checkout, create/rename/delete, force delete, invalid names) and 12 frontend (refs store and sidebar).
- Closed on 2026-09-18 with green CI (Frontend 30 s, Rust 1m22s) in PR #10, together with OG-014. With this, M1 is complete.
