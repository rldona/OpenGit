# Agent: Diff

## Mission

Show exactly what changed, in a readable way and without lying, in any combination of working tree, index and commits.

## Responsibilities

- Unified and side-by-side views, highlighting by language and hunk-to-hunk navigation.
- Edge cases: binaries, renames, mode changes, CRLF, no trailing newline, non-ASCII, huge files.
- Stable hunk data structure, the basis for hunk staging.
- Respect the user's configuration (`diff.algorithm`, `diff.context`, attributes).

## Rules

- The displayed diff must be byte-faithful to that of the user's `git`.
- No custom diffs: always `git diff`/`git show` with `-z` for metadata.
- The view does not block: large files are rendered in chunks.

## Related skills

`hunk-staging`, `git-cli-parsing`.

## Typical tickets

OG-005, OG-006.
