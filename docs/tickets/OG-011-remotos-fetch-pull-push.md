# OG-011 · Fetch, pull and push

- **Milestone:** M2 — Remotes
- **Status:** done
- **Depends on:** OG-007, OG-008, OG-010
- **References:** ADR-0003, docs/architecture/overview.md

## Context

It closes the daily cycle: synchronize with the remote without opening the terminal, with the process output visible and without hanging the app.

## Scope

- Fetch (all branches and with optional prune), pull (ff-only by default) and push.
- Progress in streaming to the output panel (transfer percentages, git phases).
- Cancellable operations; cancelling leaves the repo in a consistent state.
- Credentials via the system credential helper; `GIT_TERMINAL_PROMPT=0` to fail fast.
- Actionable errors: non-fast-forward (suggest pull/rebase), failed auth, nonexistent remote, branch without upstream (offer `--set-upstream`).
- Notice of accidental push to an unwanted `main` (extra confirmation, configurable).

## Acceptance criteria

- [x] Push to a local test repo (path, no network) streams the output in real time. _(test with local bare and streaming events)_
- [x] Cancelling halfway through a fetch leaves no orphan processes or locks in `.git`. _(test with a `pre-receive` hook that sleeps: it cancels and the job dies in <1 s)_
- [x] A push rejected by non-fast-forward shows the cause and next step. _(mapping to "Pull first" + test)_
- [x] Without configured credentials, the error explains how to configure the helper, without asking for a password in the app. _(`GIT_TERMINAL_PROMPT=0` and auth advice in the mapping)_
- [x] After push/pull, graph and sidebar refresh via watcher. _(in addition, the store refreshes refs/status/graph when finished)_

## Out of scope

- Token/SSH management from the app.
- PRs and reviews (M5 at most, open URL).
- Force push (never by default; if it ever exists, with the danger word).

## Technical notes

- `GIT_PROGRESS_DELAY=0` and `--progress` to force progress on stderr when there is no TTY.
- Progress parsing is best-effort and never blocking: the truth is the exit code.
- Tests with a local remote (`git init --bare` in tempdir), without network (rule 8 of AGENTS.md).

## Implementation notes (2026-09-18)

- Runner: `spawn_streaming` with `StreamSink`; the reader separates by `\n` or `\r` (progress uses CR) and accumulates it for the result. **Without a sink it does not touch a single byte** (CRLF patches must survive). Cancellation arrives via a shared token (`Arc<AtomicBool>`) that `wait` checks every 100 ms and kills the tree.
- `src/jobs/`: `JobKind` (fetch/pull/push with prune, remote and `set_upstream`), `JobManager` (ids and tokens), `start` with `Output`/`Finished` events. Commands `start_remote_job` / `cancel_remote_job`; events `job://output` and `job://finished`.
- Push with `set_upstream` resolves the current branch and uses `origin` by default; pull always `--ff-only`; fetch `--all` with optional `--prune`.
- UI: Fetch/Pull/Push and Cancel buttons in the toolbar; extra confirmation when pushing `main`/`master`; push without upstream activates `--set-upstream` automatically.
- `describeRemoteError` maps the output to actionable causes (non-fast-forward, auth, nonexistent remote, no upstream, nonexistent ref) with tests.
- Tests: 4 Rust with local remotes (push+upstream, fetch, non-ff, cancellation with blocking hook) and 11 frontend (error mapping and remote store).
- Closed on 2026-09-18 with green CI (Frontend 28 s, Rust 1m27s) in PR #11. With this, M2 is complete. Along the way CI revealed that without `init.defaultBranch` the test bare was left on `master`; the test remotes explicitly set `main`.
