# OG-054 · Compare commits and branches

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** ready
- **Depends on:** OG-005, OG-037
- **References:** ROADMAP.md, OG-039

## Context

Today the diff is always "something against its parent" (commit) or "against HEAD"
(working tree). SourceTree lets you select two commits or two branches and see the
diff **between them**, which is the way to answer "what does this branch change
with respect to main?" without checkout.

## Scope

- Multi-selection in the commit table (Ctrl/Cmd+click, maximum two) with
  visual indication and base → compared order.
- "Compare selected" in the context menu of commits and of sidebar branches;
  it reuses the Diff view with a new `compare` target.
- Panel header with `base..rev` and a button to exit the comparison.
- Backend: `diff_numstat` and `diff_file` accept the base/rev pair (today `rev` is
  single: `git diff <base> <rev> -- <file>`).

## Acceptance criteria

- [ ] Selecting two commits and "Compare selected" opens the diff between them.
- [ ] Same with two branches (Ctrl/Cmd+click in the sidebar).
- [ ] The panel indicates base and compared, and going back leaves the view as it was.
- [ ] Added/deleted/renamed files are listed and open correctly.
- [ ] Parser/command tests in Rust and UI tests with the mocked bridge.

## Out of scope

- Comparison history.
- Comparing more than two refs.
- Three-way merge tool.

## Technical notes

- Extend the diff store with `target: { kind: "compare", base, rev }` and a
  command that reuses `parse_numstat`/`diff_file` with two revisions.
- Multi-selection must not break the detail of a commit: with two
  rows marked, the bottom panel becomes minimal (or is blocked).
