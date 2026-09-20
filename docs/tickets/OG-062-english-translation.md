# OG-062 · Translate the project to English

- **Milestone:** M8 — SourceTree parity (phase 3) (cross-cutting)
- **Status:** done
- **Depends on:** —
- **References:** ROADMAP.md, AGENTS.md

## Context

Since 2026-09-19 the convention is English for documentation, code and
comments, but most of the repository was written in Spanish first: code
comments (~90 lines in 44 frontend files and ~110 in 24 Rust files), test
descriptions and names, ~99 markdown files (62 tickets, 8 ADRs, guides,
`.ai/`) and the v0.1.0 release notes.

This ticket translates all of it in small, reviewable batches, with CI green
between them and without touching behaviour.

## Scope

- [x] Root docs: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`,
  `ROADMAP.md`, `CONTRIBUTING.md` (PR #47).
- [x] Release notes of published releases (v0.1.0 edited on GitHub) and the
  wording the release workflow generates (already English).
- [x] Frontend comments and test descriptions (~107 files).
- [x] Rust comments, doc comments and test names/messages (`src-tauri/src` and
  `tests/`, including helper functions and assertion messages).
- [x] `docs/tickets/` (title, states and prose) and its index.
- [x] `docs/architecture/`, `docs/decisions/` and `docs/guides/`.
- [x] `.ai/` (agents, skills, workflows, memory).

## Acceptance criteria

- [x] No Spanish prose left in comments or docs (manual sweep with `rg`).
- [x] Tests keep passing between batches: translation changes no behaviour.
- [x] One batch per PR so each diff is reviewable.
- [x] Code identifiers are not renamed just to translate a comment.

## Out of scope

- Translating past commit messages or PR titles/bodies (optional, editable on
  GitHub; tracked in ROADMAP.md).
- Translating UI into more languages (the interface stays English; i18n is a
  separate decision).

## Technical notes

- Comments explain *why*; when translating, keep the reasoning, do not
  summarise it away.
- Test names in Rust (`fn cherry_pick_...`) and `it("...")` descriptions are
  part of the batch, but renaming test functions must not change what they
  assert.
- `docs/tickets/README.md` mixes states and titles: translate the whole table
  in one go to avoid half-translated rows.
