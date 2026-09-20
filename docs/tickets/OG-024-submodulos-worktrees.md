# OG-024 · Submodules and worktrees in read-only mode

- **Milestone:** M5 — Polish
- **Status:** done
- **Depends on:** OG-010
- **References:** ROADMAP.md

## Context

A repo with submodules or several worktrees does not show that information in the app: to open a worktree you have to use the folder selector and the submodules are invisible.

## Scope (v1)

- Backend: `submodule_status` (`git submodule status`, without recursion) and `worktree_list` (`git worktree list --porcelain`), with pure parsers.
- Sidebar: **Submodules** and **Worktrees** sections, visible only if there are entries.
  - Submodule: path, short commit and state (**Clean**, **Different commit**, **Not initialized**, **Conflict**).
  - Worktree: path, branch (or **detached**), mark of the current worktree and warning if it is **locked** or **bare**.
- Open a worktree or an initialized submodule as a repository with the existing `open`; the current one is not offered.
- Refresh with watcher events and with the Refresh shortcut (`mod+R`).
- Read-only: submodules are not added, removed or updated, and worktrees are not created or deleted.

## Acceptance criteria

- [x] Repo with two worktrees (branch and detached): they are listed with their branch and the current one marked.
- [x] Submodule: **Clean** when up to date, **Not initialized** after `deinit` and **Different commit** when the submodule advances; the commit shown is the one from the sub's index/HEAD.
- [x] Clicking a worktree or an initialized submodule opens that repo and the sidebar refreshes.
- [x] Robust parser: path with spaces, trailing `(describe)`, `bare`/`locked` entries and `+`/`-`/`U` status lines.
- [x] Tests: unit parsers, Rust integration with temporary repos and frontend (store and sidebar).

## Out of scope

- `submodule add/update/sync/deinit` and `worktree add/remove/prune/lock` from the app.
- Recursive or nested submodules beyond the first level.
- Showing the content of submodules in File status or in the diff.

## Technical notes

- `git submodule status` has no `-z` mode: it is parsed by lines (state char + SHA + path + trailing `(describe)`). The `describe` is detected with `rfind(" (")` requiring the line to end in `)`.
- Worktrees with `--porcelain`: blocks separated by an empty line (`worktree`, `HEAD`, `branch`, `detached`, `bare`, `locked`).
- The submodule state relative to the superproject index: ` ` up to date, `+` different commit, `-` not initialized, `U` conflict.
- A worktree can point to a subdirectory of the main repo; it is not opened on its own, the user decides (same flow as `open`).

## Implementation notes (2026-09-18)

- Rust: `Submodule`/`SubmoduleState` and `Worktree` models; `parse_submodule_status` and `parse_worktree_list` parsers; `submodule_status` and `worktree_list` commands.
- The parsers are strict: an unknown line or state returns `InvalidOutput` instead of making up data.
- Frontend: `ExtrasSidebar` on top of the `extras` store; it only appears if there are submodules, more than one worktree or an error; the current worktree and non-initialized submodules are shown disabled.
- The `mod+R` shortcut refresh and the watcher events (refs/refresh) reload the lists.
- In tests, a local `git submodule add` requires `protocol.file.allow=always` and the advance is committed in the submodule clone (not in the origin repo); noted in `.ai/memory/git-quirks.md`.
- Tests: 104 Rust (5 parser and 2 integration new), 169 frontend (8 new for store and sidebar).
- Closed on 2026-09-18 with green CI (Frontend 28 s, Rust 1m29s) in PR #20.
