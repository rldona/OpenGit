# OG-044 · 3-zone layout in history

- **Milestone:** M7 — SourceTree parity (phase 2)
- **Status:** done
- **Depends on:** OG-036, OG-037, OG-039
- **References:** ROADMAP.md, docs/architecture/overview.md

## Context

Today `HistoryView` is a horizontal split: on the left graph + commit table, on the right a narrow `CommitDetail` with metadata and buttons. To see the diff of a commit you have to press "View diff", which calls `useCommitActions.showDiff` and **navigates away** to the `diff` view (`useCommitActions.ts:30-36`), losing sight of the history.

SourceTree does not navigate: when selecting a commit the same screen splits into three zones and the diff appears below, keeping the graph context.

## Scope

- Restructure `HistoryView` into a **vertical** split:
  - **Top zone:** graph + commit table (the current one, without touching virtualization).
  - **Bottom zone:** horizontal split with the commit's file list | file diff.
  - **Commit metadata** (hash, author, date, full message, parents/refs) in a band between both zones, not in the right column.
- Selecting a commit loads its diff in the bottom zone (`useDiffStore.openCommit`) without changing `activeView`.
- With no selection, the bottom zone stays collapsed and the history takes the full height.
- Sizes of the two new splits persisted via `LAYOUT_KEYS`.
- Reuse the file/patch components already used by `DiffView`; do not duplicate patch rendering.
- Diff controls (Unified/Side by side, List/Tree) accessible from the bottom zone.
- Backend: `%b` in `LOG_FORMAT` so that the full message reaches the UI.

## Acceptance criteria

- [x] Selecting a commit shows its files at the bottom left and the diff on the right, without leaving the history view.
- [x] The commit metadata (author, date, full message) is shown below the commit list.
- [x] The bottom zone allows switching between Unified/Side by side and List/Tree.
- [x] When deselecting (Esc) the bottom zone collapses and the history recovers the full height.
- [x] The zone sizes survive an app restart.
- [x] Navigating quickly between commits does not trigger a git call per keystroke (see technical notes).
- [x] The standalone `diff` view still works for the working tree.
- [x] Tests: selection loads files, deselection collapses, and the diff is requested only once per settled commit.

## Out of scope

- Commit view for creating commits (OG-043).
- Table column sorting (OG-045).
- Stash detail (OG-046).
- Changes to the lane algorithm or `GraphCanvas`.

## Technical notes

- `openCommit` runs git. With keyboard navigation calls would chain: short debounce on `selected` and discard responses for a hash that is no longer the selected one (guard by hash, not just `cancelled`).
- `useCommitActions.showDiff` stops being the main route; it stays in the context menu but without `setActiveView("diff")` when we are already in history.
- List virtualization depends on the scroller's `clientHeight`: when the height changes because of the split, `range` must be recalculated (`updateRange` already exists, it just needs to be triggered on resize).
- `GraphCanvas` paints on a canvas aligned with the scroller; any height change forces a repaint with the correct DPR.

## Implementation notes (2026-09-18)

- `DiffView` is split into `DiffFilesPanel` (list/tree + filter) and `DiffPatchPanel` (patch, LFS, binary), both fed from the store. `DiffView` remains as toolbar + composition; history reuses the same panels instead of duplicating patch rendering.
- `HistoryView`: the split goes from horizontal (list | aside) to **vertical** (list on top / `CommitDetailPanel` below), with `collapsed={!selectedCommit}`, which also unmounts the panel and avoids useless loads.
- `CommitDetailPanel`: metadata band (subject, author, date, copyable hash, parents/refs) + horizontal split files | diff. The actions of the old `CommitDetail` are kept in the band.
- **Stale responses:** the debounce (120 ms) was not enough, because two overlapping `openCommit` calls could resolve in reverse order. The real guard lives in the store (`openToken` in `diff.ts`), which discards any response that is not from the latest open; `openWorktree` also increments it so that a pending commit does not overwrite the working tree.
- List virtualization depends on the scroller's height: a `ResizeObserver` was added that recalculates the visible range when the bottom panel changes the height.
- "View diff" in the context menu is renamed to "Open in Diff view": selecting the row already shows the diff inline, so the entry remains only as a jump to the full-screen view.
- `LAYOUT_KEYS.historyDetail` is replaced by `historyBottom` and `historyFiles`.
- Tests: 236 frontend (previously 232) and 121 Rust. New: inline detail, collapse on deselect, fast-navigation debounce and discarding a stale response in the store.

### Fix: two gaps detected after the first pass

The first implementation considered "full message" done by showing only the `subject`, and by reusing `DiffView`'s panels the bottom zone was left without the diff controls. Both closed:

- **Commit body (backend).** `LOG_FORMAT` ended in `%s`, so the body did not even leave git. Now it is `…%x1f%s%x1f%b`, with `body` in the Rust model and in the TS type.
  - The body goes **last on purpose**: it contains newlines and could contain the `0x1f` itself. The parser moves from `split_fields` to `splitn(record, FIELD_SEP, 8)`, so that any leftover separator stays inside the body instead of breaking the record. Records remain separated by NUL (`-z`), which a commit message cannot contain.
  - `%b` comes with leftover trailing newlines; `trim_end` is applied so that a commit with no body remains an empty string and not `"\n\n"`.
  - Fixture `log_topo.bin` regenerated with a commit with a multiline body (with ñ and 日本). On regeneration, the other five fixtures came out byte-for-byte identical, which confirms that `generate.sh` is deterministic.
  - New tests: multiline body without breaking the record, and empty body in the root commit. The `assert_eq!(commits.len(), 5)` becomes 6.
- **Diff controls.** `commit-diff-toolbar` band with Unified/Side by side and List/Tree. `Reverse` and staging actions are deliberately left out: a commit's diff is read-only.
- The TS type change was flagged by three test fixtures at compile time; none was detected by a runtime failure.
- Tests: 239 frontend (previously 236) and 123 Rust (previously 121).
