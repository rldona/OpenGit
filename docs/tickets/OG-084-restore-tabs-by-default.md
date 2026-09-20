# OG-084 · Restore tabs by default and skip the home flash

- **Milestone:** M15 — Remember open tabs
- **Status:** done
- **Depends on:** OG-082
- **References:** `src/lib/stores/settings.ts`, `src/App.tsx`

## Context

OG-082 shipped the "reopen tabs" preference off by default and, when it is on,
the home with recent projects flashed for a moment before the restored tabs
appeared. Reopening the session is what most users expect; anyone who does not
want it can turn it off in Settings.

## Scope

- Default `restoreTabs` to on for a fresh install.
- Suppress the home while a stored session is reopening, so the app goes
  straight to the tabs.

## Acceptance criteria

- [x] A fresh install reopens the previous session without touching Settings.
- [x] With a stored session, the recents home does not flash before the tabs.
- [x] With no stored session, or with the preference off, the home shows as
  before.
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`
  and the Rust checks green.

## Out of scope

- Changing the checkbox label or the tab it lives in.

## Implementation notes (2026-09-20)

- `settings`: `restoreTabs` defaults to `true`.
- `App`: `shouldRestoreSession()` is evaluated synchronously for the first
  render, and a `restoringSession` flag stays true until `restoreSession`
  resolves; the `Welcome`/recents view renders only when not restoring and no
  repository is open.
- Tests: settings defaults and persistence; `App` no-flash with a pending open.
