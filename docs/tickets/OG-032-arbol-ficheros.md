# OG-032 · File tree in diff and status

- **Milestone:** M5 — Polish
- **Status:** done
- **Depends on:** OG-005, OG-009
- **References:** ROADMAP.md

## Context

The file lists in diff and File status are flat. In repos with many nested files it is hard to see the structure and locate a directory.

## Scope

- Pure helper `buildFileTree`: from git paths (`a/b/c.txt`) it builds ordered directory and file nodes (directories first, then alphabetical), storing in each directory all its descendant files to aggregate counters.
- Recursive `FileTree` component: collapsible directories (expanded by default), indentation per level and rendering by callback of the file (each view keeps its row and actions).
- **DiffView**: **List / Tree** selector; in tree mode, each directory shows the sum of `+`/`-` of its files.
- **File status**: the same selector; the tree is applied inside each section (Conflicts, Staged, Unstaged, Untracked) keeping the per-file actions.
- The List/Tree preference lives in the `ui` store and is shared between both views.

## Acceptance criteria

- [x] `buildFileTree` groups by segments, orders directories before files and aggregates descendants.
- [x] Directories collapse and expand; when collapsed their descendants are hidden.
- [x] In diff, the directory counters are the sum of its files.
- [x] In File status, files keep their actions (Stage/Unstage/Discard/Delete) inside the tree.
- [x] Tests: helper, component, and both views with the toggle.

## Out of scope

- Tree view in the refs sidebar or in stashes.
- Drag and drop, multi-selection or per-directory actions.
- Persisting the preference between restarts.

## Technical notes

- The paths are git's (`/`), not system paths; the helper splits by `/` and does not touch disk.
- The collapsed state is local to the component (`Set<string>` of directory paths); it survives refreshes because the keys are stable.
- The order of the File status sections does not change; the tree only reorganizes the rows of each section.

## Implementation notes (2026-09-18)

- `lib/tree.ts`: generic `buildFileTree` (directories first, then alphabetical; each directory stores its descendant files); an initial bug lost the root files and it is covered by the tests.
- `FileTree`: recursive, local collapse per directory path (survives refreshes), `renderFile` and `renderDirExtra` by callback.
- Diff and status share the **List / Tree** toggle from the `ui` store (tree by default); in tree mode the rows show the name and the `title` keeps the full path.
- Tests: 199 frontend (8 new: helper, component and toggle in both views); 114 Rust untouched (UI-only change).
- Closed on 2026-09-18 with green CI (Frontend 37 s, Rust 1m49s) in PR #29.
