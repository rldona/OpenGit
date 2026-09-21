# OG-099 · Internationalization (framework + Spanish locale)

- **Milestone:** M20 — Internationalization
- **Status:** done
- **Depends on:** OG-014
- **References:** `docs/decisions/ADR-0009-i18n.md`, `ROADMAP.md`, `.ai/skills/tauri-ipc/SKILL.md`

## Context

The UI is English-only by decision (OG-014): strings are hardcoded in the
components and Rust return values. Internationalization "was left to be decided
later"; this ticket opens that decision and lays the foundation for a Spanish
locale.

## Scope

- ADR-0009 decides the approach: a typed in-house catalog, no new dependency,
  `Intl` for dates and numbers, and backend messages mapped from `GitError`
  kinds instead of translating Rust text.
- Build the mechanism: `Messages` type derived from the English catalog, `en`
  and `es` catalogs, a `t(key, params?)` with interpolation, a non-reactive
  `t` for stores/handlers and a `useI18n()` hook for components, and a locale
  store persisted like the theme preference.
- Migrate the app shell: `App.tsx` (workspace views, welcome, output),
  `Toolbar.tsx`, `RepoTabs.tsx` and `RecentProjects.tsx`.
- The remaining components are migrated area by area in OG-102..OG-105; this
  ticket is the framework plus the shell.

## Acceptance criteria

- [x] ADR-0009 records the approach and the dependency decision.
- [x] Keys are typed: a missing key or catalog entry fails `typecheck`.
- [x] The Spanish catalog covers the same keys as English; adding a locale is a
      single file plus one union member.
- [x] `t()` interpolates `{name}` parameters; `useI18n()` re-renders on a
      locale change.
- [x] The shell renders in both locales; tests cover the catalog parity, the
      interpolation and a component in English and Spanish.
- [x] `npm run lint`, `npm run typecheck`, `npm run test` green.

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

## Implementation notes (2026-09-21)

- `src/lib/i18n/messages.ts` (`en`, source of truth), `messages.es.ts` (`es:
  Messages`), `locale.ts` (union, storage key, system locale) and `index.ts`
  (`translate`, `interpolate`, non-reactive `t`, `useI18n`). `src/lib/stores/
  locale.ts` holds the preference (`null` = system) and is persisted like the
  theme.
- The shell was migrated to `t()`: `App.tsx`, `Toolbar.tsx`, `RepoTabs.tsx` and
  `RecentProjects.tsx`; the English rendering is unchanged.
- Tests: catalog parity (recursive key comparison), interpolation, `t` across
  locales, the hook re-rendering on change and a component in both languages.
  Verified `lint`, `typecheck`, `format:check` and `npm test` (541).
- Remaining strings are tracked area by area in OG-102..OG-105; M20 closes when
  they are done.
