# ADR-0003 · The system `git` binary as the engine

- **Status:** accepted
- **Date:** 2026-09-18
- **Deciders:** Raúl López

## Context

The app needs to read history, compute diffs and run operations that write to
the repository. There are three usual paths: invoking the system `git`, linking
`libgit2` or using `gitoxide` (gix). Fidelity with git's real behaviour (hooks,
filters, configuration, credentials, LFS, submodules) is a de facto requirement.

## Decision

Use the **system `git` binary** for all write operations and most reads. `gix`
remains a future option for hot reads only, never as the write engine.

## Alternatives considered

- **libgit2 (`git2-rs`)** — fast to read, but it diverges from git in edge cases
  and does not run hooks or respect all configuration; historically it is the
  source of subtle bugs in graphical clients.
- **Pure gitoxide (`gix`)** — excellent performance and memory safety, but
  incomplete coverage of write operations and configuration-dependent
  behaviours.

## Consequences

- Credentials, hooks, attributes, LFS filters and `includeIf` work "for free"
  because it uses the user's git.
- Performance depends on `git`; in large repositories it is mitigated with
  bounded queries (`--max-count`, pagination) and by never parsing human or
  HTML output.
- Obligation of robust parsing: `-z`, `--porcelain=v2`, `--format` with NUL
  separators. See the `git-cli-parsing` skill.
- Minimum supported version: **git 2.34+**; it is detected when opening a repo
  and the user is warned when it is older.
- Processes are launched with `GIT_TERMINAL_PROMPT=0` (never hang asking for
  credentials on the console), `LC_ALL=C` and cancellation by killing the
  process tree.
