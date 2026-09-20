# OG-040 · Incoming/outgoing commits with badges

- **Milestone:** M6 — Visual parity with SourceTree
- **Status:** done
- **Depends on:** OG-008, OG-037
- **References:** ROADMAP.md

## Context

Tracking is only shown next to the current branch (global ↑/↓) and the graph does not distinguish commits that are yet to arrive from the upstream or pending to be pushed. SourceTree marks each branch with its counters and paints incoming commits differently.

## Scope

- **Per-branch badges**: the sidebar uses the `track` field of `for-each-ref` (`[ahead N, behind M]`) to show `↑n`/`↓m` on any branch with an upstream, not only the current one. Pure parser `parseTrack`.
- **Incoming/outgoing commits**:
  - Rust: `tracking_commits(path, upstream)` returns the hashes of `HEAD..upstream` (incoming) and `upstream..HEAD` (outgoing), limited to 200 per side and with ref validation.
  - Refs store: `incoming`/`outgoing` are loaded and refreshed along with `branchTracking` when there is an upstream.
  - History: each row with a hash in `incoming`/`outgoing` shows a `↓`/`↑` badge and a color mark (incoming ones in accent), without touching virtualization.

## Acceptance criteria

- [x] Any branch with an upstream shows its ↑/↓ counters in the sidebar.
- [x] `tracking_commits` validates the ref and returns the correct incoming/outgoing hashes.
- [x] History rows mark incoming and outgoing commits with badge and class.
- [x] Without an upstream, the lists are empty and there is no extra git call.
- [x] Tests: track parser, `tracking_commits` integration, store, sidebar and history.

## Out of scope

- Automatic fetch when opening the repo or refreshing (the sets are computed against local refs).
- Per-remote or per-remote-branch counters (only each local's upstream).
- Rewriting the graph to color whole incoming lanes.

## Technical notes

- `parseTrack` accepts `[ahead 1, behind 2]`, `[ahead 1]`, `[behind 2]`, `[gone]` and empty (returns `null` for the last two).
- `tracking_commits` uses `git rev-list --max-count=200 --end-of-options` with the range and rejects refs with spaces, `..` or a leading hyphen.
- The sets live in the refs store so that the sidebar and the history share the same snapshot.

## Implementation notes (2026-09-18)

- Rust: `TrackingCommits` and `tracking_commits` with `rev-list --max-count=200 --end-of-options`; rejects refs with spaces, `..` or a leading hyphen. Integration test with a remote commit that leaves the base (if it descended from the local, both sets would be empty).
- Frontend: `parseTrack` for `[ahead N, behind M]` (also `[gone]`/empty → null); the sidebar renders ↑/↓ on any branch with an upstream using the `track` field of `for-each-ref`; the refs store loads incoming/outgoing only if there is an upstream (one extra call per refresh).
- History: ↓/↑ badge and `incoming`/`outgoing` class per row; incoming ones tint the subject with the accent.
- Tests: 232 frontend (2 parseTrack, 2 store, assertions in sidebar and App) and 121 Rust (1 integration).
- Closed on 2026-09-18 with green CI (Frontend 50 s, Rust 1m58s) in PR #37. With this, M6 is complete.
