# OG-090 · Bisect

- **Milestone:** M17 — Recovery and debugging
- **Status:** backlog
- **Depends on:** OG-003, OG-019
- **References:** `src-tauri/src/git/`, `src/components/OpBanner.tsx`

## Context

`git bisect` finds the commit that introduced a bug, but it is a terminal-only
flow. It fits the existing in-progress operation banner (OG-019) and checkout.

## Scope

- Rust commands: start (with optional bad/good revs), mark good/bad, skip,
  reset; a command to read the bisect state (steps left, current commit,
  candidates).
- UI: start dialog, good/bad/skip/reset actions and a banner showing the
  remaining steps; check out the candidate automatically.

## Acceptance criteria

- [ ] Starting a bisect checks out the midpoint and shows the remaining steps.
- [ ] Marking good/bad/skip advances the search; reset ends it cleanly.
- [ ] The banner appears only while a bisect is in progress.
- [ ] Tests with temporary repositories and a scripted history.
- [ ] Checks green.

## Out of scope

- `git bisect run` with an automated script.
- Visualising the whole bisect range in the graph.

## Technical notes

- The current commit of a bisect is detached HEAD; reuse `head_info` and the
  existing checkout plumbing.
- Read the state from `git bisect visualize`/`git rev-list` rather than parsing
  localized prose.
