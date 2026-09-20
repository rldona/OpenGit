---
name: git-cli-parsing
description: Use when writing or reviewing any Rust code that invokes the system git binary or parses its output (runner, parsers, commands like log, status, refs, diff). Triggers on git invocation, stdout/stderr parsing, -z, porcelain, for-each-ref, ls-tree. Covers argv safety, locale, quoting, byte paths and exit codes.
---

# Invoking and parsing git

## Invocation

- `Command::new("git")` with `args([...])`. **Never** a shell, never `sh -c`, never interpolate input into a string.
- Explicit working directory (`current_dir`) or `-C <path>`; the repo is not the process's cwd.
- Controlled environment on each call:
  - `GIT_TERMINAL_PROMPT=0` — if credentials are missing, an error instead of blocking.
  - `LC_ALL=C` / `LANG=C` — stable messages (even if they are not parsed).
  - `GIT_OPTIONAL_LOCKS=0` on reads — avoids touching the index and triggering watchers.
  - `GIT_PROGRESS_DELAY=0` + `--progress` when progress is wanted without a TTY.
  - `GIT_CONFIG_GLOBAL` / `GIT_CONFIG_NOSYSTEM` only in tests, never in the app.
- Data via stdin when they contribute: patches (`git apply -`), commit messages (`-F -`), objects.
- Timeout and cancellation: kill the process and its descendants; don't leave locks in `.git`.

## Parsing

- Machine output, always: `-z`, `--porcelain=v2`, `--format` with separators (`%x00`, `%x1f`) and `--no-color`.
- **Never** parse default output or localized messages.
- Paths: with `-z` they come without quoting; don't split them by `\n` or assume UTF-8 on Unix (they can be bytes). Treat them as `OsStr`/bytes; convert to text only for display (`to_string_lossy`).
- `-z` changes the separator, not the structure: each record still has internal fields separated by space or `%x1f`.
- Exit codes per command, not universal: `git diff --exit-code` uses 1 for "there are differences" and 2 for error; `git grep` uses 1 for "no results".

## Recipes

```rust
// Log page
git log --topo-order --parents --max-count=200 --skip=0 \
  --format=%H%x00%P%x00%an%x00%ae%x00%at%x00%D%x00%s%x00
```

```rust
// Machine status (first line: # branch.oid / # branch.head)
git status --porcelain=v2 -z --branch --untracked-files=all
```

```rust
// Refs with upstream and objecttype
git for-each-ref --format=%(refname)%00%(objectname)%00%(objecttype)%00%(upstream)%00%(upstream:track) refs/heads refs/remotes refs/tags
```

- With `--format`, add a NUL terminator or a trailing `%x00` per record so as not to depend on the newline.
- `core.quotepath=false` is only necessary when the command doesn't support `-z`; even then, prefer `-z`.

## Anti-patterns

- `Command::new("sh").arg("-c")` or `format!("git log {}", user_input)`.
- `split('\n')` for records that contain multiline messages.
- Parsing `git status` "short" without `-z` for paths with spaces or non-ASCII.
- Trusting the user's global configuration for output (aliases, `color.ui`, `pager`): always use explicit flags.
- Launching commands without a timeout on the UI thread.
