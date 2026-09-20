# Git — quirks

## fetch/push progress doesn't show without a TTY

- **Date:** 2026-09-18
- **Context:** designing the streaming output panel for M2.
- **Finding:** git disables progress when stderr is not a terminal. With `GIT_PROGRESS_DELAY=0` and `--progress` it's forced anyway.
- **Implication:** launch network operations with those variables/flags and parse the progress as best-effort; the truth is the exit code.

## `GIT_OPTIONAL_LOCKS=0` on reads

- **Date:** 2026-09-18
- **Context:** preventing the `.git` watcher from reacting to our own reads.
- **Finding:** `git status` can refresh the index and touch `.git/index` even if you change nothing.
- **Implication:** export `GIT_OPTIONAL_LOCKS=0` on read commands; the watcher is also paused during our own operations (OG-010).

## Non-UTF8 paths on Unix

- **Date:** 2026-09-18
- **Context:** modeling file names between Rust and JSON.
- **Finding:** on Unix a path can be bytes that are invalid UTF-8; `-z` delivers them as-is, without quoting.
- **Implication:** don't `unwrap()` `to_str()` on paths; preserve `OsString`/bytes and use `to_string_lossy` only for display.

## `core.quotepath=false` only when there is no `-z`

- **Date:** 2026-09-18
- **Context:** names with accents came out escaped (`\303\261`) in some queries.
- **Finding:** git quotes non-ASCII paths in non-`-z` output; with `-z` it doesn't apply.
- **Implication:** always prefer `-z`; if a command doesn't support it, add `-c core.quotepath=false`.

## Commit messages with `-m` and a shell

- **Date:** 2026-09-18
- **Context:** committing from the app.
- **Finding:** interpolating the message into `-m` requires escaping quotes and breaks line breaks.
- **Implication:** pass the message via stdin (`-F -`), never concatenated.

## Git output is not normalized when there is no streaming

- **Date:** 2026-09-18
- **Context:** OG-011 added a line reader for fetch/pull/push progress (which uses `\r`).
- **Finding:** when also splitting on `\r` for normal commands, CRLF patches lost the `\r` and `git apply` failed (`patch does not apply`). Regression caught by the OG-006 tests.
- **Implication:** `read_stream` only normalizes when there is a sink; without it, `read_to_end` byte by byte. Any change to the runner must pass the staging suite with CRLF.

## Tracking requires a configured remote, not just the ref

- **Date:** 2026-09-18
- **Context:** OG-008 tests with `refs/remotes/origin/x` created with `update-ref`.
- **Finding:** `git branch --set-upstream-to=origin/x` and `git checkout --track origin/x` fail with `starting point is not a branch` if there is no `origin` remote in the config, even though the remote ref exists.
- **Implication:** in tests, add `git remote add origin <nonexistent-path>` first (no network). In the app it doesn't apply because remotes come from the user's repo.

## Commit hook output goes to stdout

- **Date:** 2026-09-18
- **Context:** OG-007; when a `pre-commit` failed, only git's stderr was visible.
- **Finding:** hooks write their messages to **stdout**; `GitError::CommandFailed` only saved stderr and the real cause was lost.
- **Implication:** `CommandFailed` includes `stdout` and `stderr`; when showing errors, prefer stderr and fall back to stdout. The commit message is passed via stdin (`--file=-`), without `--no-verify`.

## Partial staging: a discarded `-` must become context

- **Date:** 2026-09-18
- **Context:** line-by-line patch reconstruction in OG-006.
- **Finding:** if you deselect the `-old` line of an `-old/+new` pair, the index still has `old`; emitting the patch without it breaks the following context (`error: patch does not apply`). It must be emitted as context (` old`). Discarded `+` lines are simply omitted, and `\ No newline at end of file` markers are only valid if their line is still in the patch.
- **Finding 2:** git merges changes separated by less than 2×context (3 lines by default) into a single hunk; when writing hunk tests you must separate them by more than 6 lines.
- **Implication:** implemented and covered in `git::patch::ParsedPatch::build`; any change there requires passing the CRLF and no-final-newline tests.

## Exact formats with `-z` (log, status, numstat)

- **Date:** 2026-09-18
- **Context:** OG-003 parsers; the non-obvious details were verified with real fixtures.
- **Finding:**
  - `git log -z --format=...`: `-z` separates commits with NUL (in addition to the format separators); with `%x1f` between fields you get a clean token stream.
  - Rename in `status --porcelain=v2 -z`: the new path closes the record and the original is the **next token** NUL, not a field of the same token.
  - Rename in `diff --numstat -z`: the counters token carries the empty path (`1\t0\t`) and both paths are in the next two tokens.
- **Implication:** parse by sequential tokens with an index, don't pre-split records assuming one NUL per entry. The real fixtures are in `src-tauri/tests/fixtures/` and are regenerated with `generate.sh`.

## Interactive rebase without an editor: GIT_SEQUENCE_EDITOR and reword with `exec`

- **Date:** 2026-09-18
- **Context:** OG-021; `git rebase -i` must run with a plan generated by the app, without opening editors.
- **Finding:**
  - `GIT_SEQUENCE_EDITOR="cp '<todo>'"` works: git invokes `<editor> <todo-file>`, so `cp` receives source and destination. The todo lives in the app's data directory, never in the repo.
  - The `reword` action opens the message editor, which clashes with the `GIT_EDITOR=true` we use to accept squash's default messages. It is solved by emitting `pick <sha>` + `exec git commit --amend -F '<message>'`; that way each reword (in v1, one) has its message without an editor.
  - In a squash, the resulting subject is that of the **previous** commit (the one that receives), not that of the squashed one: `pick c1; squash c2` leaves c1's subject and c2's message in the body.
- **Implication:** the todo-list is an internal detail of `interactive_rebase`; any change must cover squash/fixup, drop, reword, reordering and conflict with abort.

## Local submodules: `protocol.file.allow` and where the clone lives

- **Date:** 2026-09-18
- **Context:** `git submodule status` tests (OG-024) with local repos, without network.
- **Finding:** since git 2.38.1 the `file://` protocol is restricted and `git submodule add <local-path>` fails without `-c protocol.file.allow=always`. Moreover, a commit in the origin repo **does not move the submodule**: `submodule add` clones into `<super>/.git/modules/<path>`; the `+` state (different commit) only appears when committing inside `super/<path>`. `deinit`'s `-` and clean's space are computed against the gitlink of the superproject's index.
- **Implication:** submodule tests use `protocol.file.allow=always` and commit in the submodule clone (not in the origin repo).

## Line-trimmed patches: `git apply --unidiff-zero`

- **Date:** 2026-09-18
- **Context:** OG-031, discarding hunks/lines by reconstructing the diff patch and applying it in reverse to the working tree.
- **Finding:** when selecting loose lines, the reconstructed hunk can end up with an edge without context (e.g. ending in `+line`). `git apply` rejects those hunks with "patch does not apply" even if the content matches, both forward and `--reverse`, unless `--unidiff-zero` is passed.
- **Implication:** the stage (`--cached`) and discard (worktree) appliers use `--unidiff-zero`; safety comes from reconstructing the patch from the freshly read diff, not from git's context heuristic.

## `git log --follow` needs a single starting point

- **Date:** 2026-09-19
- **Context:** OG-053, file history across renames.
- **Finding:** `--follow` cannot be combined with `--all` (it tracks one path from one commit). The path must come after `--`, and `--follow` only works with exactly one pathspec.
- **Implication:** with `follow` (and a path) `log_page` walks `HEAD` (or the given rev) and never `--all`; renames before the tracked name are only found by `--follow`, not by a plain path filter.

## `--squash` does not write `MERGE_HEAD` but can still conflict

- **Date:** 2026-09-19
- **Context:** OG-059, squash merges.
- **Finding:** `git merge --squash` stages the result without committing and without creating `MERGE_HEAD`, yet a content conflict still leaves unmerged entries in the index. `-X ours|theirs` only resolves content conflicts, and still produces the merge commit.
- **Implication:** conflict detection stays on `git ls-files --unmerged` (not `MERGE_HEAD`), the same as `--no-commit`; the UI must not expect a merge commit after `--squash`.

## `git worktree remove` without `--force` is the dirty check

- **Date:** 2026-09-19
- **Context:** OG-058, removing worktrees.
- **Finding:** `git worktree remove <path>` fails on uncommitted changes with "use --force to delete it"; the main worktree always fails. The failure message is the signal, like force-deleting branches.
- **Implication:** the UI confirms, tries without `--force`, and only forces after a second explicit warning; the main worktree is never removable.

## Local submodule tests: `protocol.file.allow` must reach the child clone

- **Date:** 2026-09-19
- **Context:** OG-057, `submodule_add` integration test against a local source.
- **Finding:** setting `protocol.file.allow=always` in the superproject's local config does **not** propagate to the `git clone` that `submodule add` spawns. It must come from the environment/config parameters (`-c`, or `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0`) which children inherit.
- **Implication:** the test process sets the `GIT_CONFIG_*` env vars; the app command never forces `protocol.file.allow` (security).
