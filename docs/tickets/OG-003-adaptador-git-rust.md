# OG-003 · Git adapter in Rust: runner and parsers

- **Milestone:** M1 — Local MVP
- **Status:** done
- **Depends on:** OG-001
- **References:** ADR-0003, skill `git-cli-parsing`

## Context

Everything else in the app depends on a single, safe layer to run git and turn its output into typed models. It is the most critical piece of M1.

## Scope

- Process runner: `argv` without a shell, working directory, controlled environment (`GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`, `GIT_OPTIONAL_LOCKS=0` on reads), timeout and cancellation (kill of the process and its children).
- Separate capture of `stdout`/`stderr`, interpreted exit codes and typed error (`GitError`) with a message for the UI.
- Initial parsers, all with `-z` or `--format` with NUL separators:
  - paginated log (`--topo-order --parents`);
  - status (`--porcelain=v2 -z --branch`);
  - refs (`for-each-ref --format ... -z`);
  - diff/numstat (`-z`), with binary and rename detection.
- Models shared with the frontend: `Commit`, `FileStatus`, `Ref`, `FileDiff`.
- Git version detection and minimum 2.34.

## Acceptance criteria

- [x] Running git with arguments containing spaces, quotes and UTF-8 works without a shell. _(test `ejecuta_args_con_espacios_comillas_y_utf8`)_
- [x] A cancelled command leaves no orphan processes. _(cancellation and timeout tests; it is checked that the pid no longer exists)_
- [x] Each parser has unit tests with real output fixtures, including: empty repo, detached HEAD, rename, binary, CRLF, no trailing newline and non-ASCII. _(11 tests, fixtures in `src-tauri/tests/fixtures/`)_
- [x] No parser interprets localized messages or default git output. _(only `-z`, `--porcelain=v2` and `--format`)_
- [x] Git errors (exit code ≠ 0) reach the UI with stderr and code. _(`GitError::CommandFailed` serializable)_

## Out of scope

- Write operations (commit, checkout, stage) — they go in their own tickets.
- `gix` or any alternative reading (ADR-0003 leaves it for later).

## Technical notes

- Fixtures are Rust strings (`include_str!` or constants) generated with the supported git version; without touching disk or network (rule 8 of AGENTS.md).
- For integration tests, temporary repos with `git init` in `tempdir`, created and destroyed by the test.
- The runner must expose a trait so it can be mocked in tests of commands that do not need real git.

## Implementation notes (2026-09-18)

- Module `src-tauri/src/git/`: `runner.rs` (process, timeout, cancellation), `parsers/` (log, status, refs, numstat), `models.rs`, `error.rs`, `version.rs` and high-level queries in `mod.rs` (`log_page`, `status`, `refs`, `diff_numstat`, `has_commits`).
- New justified dependencies: `serde` (serializable error and models for the UI) and `libc` only on Unix (kill the process group on cancel; on Windows `taskkill /T` is used).
- The runner launches processes in their own group (`process_group(0)`), sends SIGTERM and escalates to SIGKILL after a 500 ms grace period.
- `GitProcess::cancel` is meant to be called before `wait`; to cancel from the UI it will have to be wrapped (OG-011) or expose a shared handle.
- Fixtures regenerable with `src-tauri/tests/fixtures/generate.sh` (deterministic); the exact formats of `status` and `numstat` with `-z` were documented in `.ai/memory/git-quirks.md`.
- Closed on 2026-09-18: PR #2 with green CI (Frontend 14 s, Rust 1m32s) after rewriting the history to sign the commits with the GitHub noreply.
