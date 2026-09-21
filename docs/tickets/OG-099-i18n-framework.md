# OG-099 · Internationalization (framework + Spanish locale)

- **Milestone:** M20 — Internationalization
- **Status:** backlog
- **Depends on:** OG-014
- **References:** `docs/decisions/ADR-0009-i18n.md`, `ROADMAP.md`, `.ai/skills/tauri-ipc/SKILL.md`

## Context

The UI is English-only by decision (OG-014): strings are hardcoded in the
components and Rust return values. Internationalization "was left to be decided
later"; this ticket opens that decision and lays the foundation for a Spanish
locale.

## Scope (to be refined after the decision)

- Decide the approach in an ADR (a dependency such as `i18next`/`react-i18next`
  against a minimal typed dictionary with no new dependency) and justify it
  under rule 5 of `AGENTS.md`.
- Extract the UI strings into a message catalog with an `en` source locale and
  an `es` translation, without changing the rendered English UI.
- Interpolate variables and handle plurals and dates through the chosen
  mechanism; no string concatenation built by hand if it can be avoided.
- Include the Rust-produced user-facing strings (error messages that reach the
  UI, menu labels, operation names) in the catalog or map them through error
  kinds instead of translating raw text.
- Keep the catalog typed so a missing key fails `typecheck`.

## Acceptance criteria

- [ ] An ADR records the approach and the dependency decision.
- [ ] All UI strings live in the catalog; the English rendering is unchanged.
- [ ] The Spanish catalog covers the same keys; adding a locale is a single
      file.
- [ ] Missing or unused keys are caught by `typecheck`/tests.
- [ ] Tests cover a component rendering in both locales.
- [ ] Checks green.

## Out of scope

- The language selector and persistence: OG-100.
- Translating documentation, comments, commit messages or the ROADMAP.
- Locales beyond `en` and `es`.
- Localizing git's own output; only the app's strings are translated.

## Technical notes

- Prefer the smallest mechanism that keeps keys typed; the project avoids new
  dependencies unless justified, so a hand-rolled dictionary is a valid answer.
- The graph and log can render thousands of rows: resolving a message must not
  re-render on every row.
- `src/lib/bridge/types.ts` mirrors the Rust models; user-facing error text
  should be derived from `GitError` fields, not stored pre-translated.

## Implementation notes

_(filled in when the ticket closes)_
