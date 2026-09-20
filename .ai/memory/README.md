# Project memory

Non-obvious knowledge acquired during development: quirks of git, of the three OSes, of Tauri, of performance or of the tools. Here we write what doesn't deserve an ADR but saves time next time.

## When to add here

- You discover a strange behavior of git (or of a specific version) that conditions the code.
- A platform case forces a workaround (WebKit, Windows, paths, DPI, packaging).
- A relevant performance measurement with its context (repo, size, machine).
- A bug that took you more than an hour to understand.

## Format

Thematic files (`git-quirks.md`, `platform-quirks.md`, `performance.md`). Each entry:

```markdown
## Short title

- **Date:** YYYY-MM-DD
- **Context:** what you were doing.
- **Finding:** what you discovered, with the command/output if applicable.
- **Implication:** what to do (or not do) from now on.
```

Rule: data, not opinions; if something stops being true (new version of git or Tauri), the entry is corrected or marked as obsolete.
