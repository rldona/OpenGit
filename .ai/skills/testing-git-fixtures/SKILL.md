---
name: testing-git-fixtures
description: Use when writing tests for git parsers or git-dependent behavior (fixtures, temp repos, tempdir, deterministic commits, CRLF, non-ASCII paths, binary files). Triggers on fixture, test repo, git init, tmpdir, integration test, parser test, CI matrix. Covers isolation from user config, deterministic dates and offline rules.
---

# Git tests: fixtures and temporary repos

## Two levels

1. **Parsers (unit):** fixtures as strings in the repo (`tests/fixtures/*.txt`) loaded with `include_str!`. No disk, no network, no git.
2. **Integration:** temporary repos created by the test with `git init`. No network, no project repo (rule 8 of AGENTS.md).

## Mandatory environment isolation

A test can't depend on the developer's or the machine's config:

```rust
// Rust: test helper
cmd.env("GIT_CONFIG_GLOBAL", &empty_config)   // empty file inside the tempdir
   .env("GIT_CONFIG_NOSYSTEM", "1")
   .env("GIT_TERMINAL_PROMPT", "0")
   .env("TZ", "UTC")
   .env_remove("GIT_DIR")
   .env_remove("GIT_WORK_TREE");
```

- In the test's `git commit`: `-c user.name=Test -c user.email=test@example.com -c commit.gpgsign=false -c core.autocrlf=false`.
- Fixed dates: `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` (format `@1700000000 +0000`) for reproducible timestamps.
- Don't use `/dev/null` as global config: it doesn't exist on Windows; use an empty file in the tempdir.

## Case matrix (mandatory when touching parsers)

| Case | How to trigger it |
| --- | --- |
| Empty repo | `git init` without commits |
| Detached HEAD | `git checkout <hash>` |
| Rename | `git mv` + commit with `-M` |
| Binary | null bytes in the file |
| CRLF | write the file with `\r\n` and without `core.autocrlf` |
| No trailing newline | `printf 'x' > f` (without `\n`) |
| Non-ASCII | path `carpeta/ñandú-日本.txt` |
| Merge / conflict | two branches on the same line |
| Submodule (read) | `git submodule add` of a local repo |

## Execution rules

- Clean up when done: on Windows, a live git process holds locks in `.git`; close before deleting the tempdir.
- No `sleep` to "wait" for the watcher: expose a signal or inject a fake notifier.
- Performance tests use a synthetic repo of 10,000 commits generated with `git fast-import` or `commit-tree` in a loop; they don't go into the fast suite.

## Anti-patterns

- Inheriting the user's global config (`gpgsign`, hooks, `init.defaultBranch` changes the branch name).
- Creating test repos inside the project repo.
- "Made-up" fixtures by hand instead of real git output from the supported version (2.34+).
- Tests that depend on execution order or share a tempdir.
