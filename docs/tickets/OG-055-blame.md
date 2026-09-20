# OG-055 · Per-line blame

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** ready
- **Depends on:** OG-005, OG-037
- **References:** ROADMAP.md, OG-053

## Context

Faced with a weird line, the question is always "who and when wrote it and in
which commit?". The per-file history (OG-053) gets closer, but does not answer per
line; blame does, and SourceTree has it.

## Scope

- Rust command `blame_file(path, file)` with `git blame --line-porcelain -M`
  (detection of lines moved within the file) and its own parser with
  fixtures; never parse "human" output.
- Blame view: line number, author, relative date and short hash, with the
  content of the line.
- Clicking a line jumps to the commit in the history (reuses `select`).
- "Blame" in the context menu of files in history and status.

## Acceptance criteria

- [ ] Opening the blame of a file shows one row per line with author,
      date and commit.
- [ ] Clicking a row opens that commit in the history, selected.
- [ ] Binary or untracked file: clear message, no raw error.
- [ ] Large files respond without blocking the UI.
- [ ] Parser tests with fixtures and view tests with the mocked bridge.

## Out of scope

- Annotations ignoring whitespace (`-w`, `-M` already covered).
- Blaming line ranges.
- Side-by-side blame view with the original content.

## Technical notes

- `--line-porcelain` is stable and designed for parsers; separate records
  by repeated commit headers and keep the last one.
- The hash of each line arrives in the header; the date and author can come from
  the header or from a later `author`/`author-time` block: document the
  parser with a real fixture.
