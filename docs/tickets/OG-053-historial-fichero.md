# OG-053 · File history

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** done
- **Depends on:** OG-009, OG-044
- **References:** ROADMAP.md, OG-018

## Context

Viewing the diff of a file is easy, but there is no way to see **its history**:
which commits touched it. SourceTree offers it as "Log Selected" from the
file tree and from the diff itself. Going back you can only search manually,
commit by commit.

## Scope

- "Show file history" in the context menu of status files, of the diff trees
  (status and commit detail) and of the patch panel.
- History mode filtered by path: the History view shows a band with the
  active path and a button to remove it.
- Reuse the path-search backend (`log_page` with `search.path`).

## Acceptance criteria

- [x] From a modified file, "Show file history" opens the history with only
      the commits that touched it, including renames (`--follow` or
      documented equivalent).
- [x] The band indicates the path and allows returning to the full history.
- [x] It works the same from a file of the commit detail and of the diff.
- [x] Selection and scroll behave as in the normal history.
- [x] Store and UI tests with the mocked bridge.

## Out of scope

- Blame (OG-055).
- Copy detection (`-C`).

## Technical notes

- `logPage` already accepts `search.path`; the work is about view context: the
  path filter must coexist with the branch one and survive `reload`.
- For renames, `git log --follow` cannot be combined with all the options of
  the current log: decide and document the trade-off (probably `--follow`
  only when there is a path).
