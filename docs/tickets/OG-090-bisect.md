# OG-090 · Bisect

- **Milestone:** M17 — Recovery and debugging
- **Status:** done
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

- [x] Starting a bisect checks out the midpoint and shows the remaining steps.
- [x] Marking good/bad/skip advances the search; reset ends it cleanly.
- [x] The banner appears only while a bisect is in progress.
- [x] Tests with temporary repositories and a scripted history.
- [x] Checks green.

## Out of scope

- `git bisect run` with an automated script.
- Visualising the whole bisect range in the graph.

## Technical notes

- The current commit of a bisect is detached HEAD; reuse `head_info` and the
  existing checkout plumbing.
- Read the state from `git bisect visualize`/`git rev-list` rather than parsing
  localized prose.

## Implementation notes (2026-09-20)

- Rust: `bisect_start` / `bisect_mark` / `bisect_reset` (argv-only) and
  `bisect_state`, which detects `.git/BISECT_START`, reads HEAD and computes the
  remaining commits with `git rev-list --count <bad> --not <goods>` from the
  `refs/bisect/*` refs — no localized output is parsed.
- Frontend: a `bisect` store, a **Start Bisect** dialog (bad defaults to HEAD,
  good commits as a list) opened from Repository → **Bisect…**, and a banner
  with Good/Bad/Skip/Reset while a bisect is active.
- Tests: the Rust start/mark/state/reset over a scripted history; the store.
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (73 files, 528
  tests), `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check`.
