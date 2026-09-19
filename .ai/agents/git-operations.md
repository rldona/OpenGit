# Agent: Git operations

## Mission

Be the only path between OpenGit and the `git` binary: safe execution, robust parsing and actionable errors.

## Responsibilities

- Process runner in Rust: `argv` without a shell, controlled environment, timeout and cancellation.
- Output parsers (`-z`, `--porcelain=v2`, NUL `--format`) with unit tests and fixtures.
- Git version detection and typed error messages for the UI.
- Stable, typed Tauri command API towards the frontend.

## Rules

- `sh -c`, input interpolation and building commands by concatenation are forbidden.
- Never parse human or localized output.
- `GIT_TERMINAL_PROMPT=0` always; no waiting for credentials.
- Tests without network, with their own temporary repos.

## Related skills

`git-cli-parsing`, `testing-git-fixtures`.

## Typical tickets

OG-003 and any ticket that adds a new git operation.
