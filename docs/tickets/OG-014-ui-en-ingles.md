# OG-014 · UI in English (pre-i18n)

- **Milestone:** M1 — Local MVP
- **Status:** done
- **Depends on:** —
- **References:** AGENTS.md

## Context

The app was born with the UI texts in Spanish. The project convention is code and identifiers in English; the UI will be in English too, and later it will be decided whether to add multiple languages (Spanish included).

## Scope

- Translate to English all visible texts: components, stores, bridge and Rust core error messages, native dialog titles and the HTML `lang`.
- Keep documentation, tickets, ADRs and memory in Spanish.
- Update the tests that check texts.

## Acceptance criteria

- [x] No UI text is left in Spanish (outside `docs/`, `.ai/` and comments). _(verified with grep over `src/`)_
- [x] Frontend and Rust tests green with the new strings. _(74 and 62 tests)_
- [x] Lint, typecheck, build and `tauri build` green.

## Out of scope

- i18n infrastructure (translation files, language selector): to be decided later.

## Implementation notes (2026-09-18)

- Components (`App`, `HistoryView`, `StatusView`, `CommitPanel`, `DiffView`, `PatchView`), stores (`repo`, `status`, `commit`), `formatGitError` messages, native dialogs and Rust core error messages were translated.
- `AGENTS.md` sets the rule: UI in English, documentation in Spanish.
- Closed on 2026-09-18 with green CI (Frontend 30 s, Rust 1m22s) in PR #10, together with OG-008.
