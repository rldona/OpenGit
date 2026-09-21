# OG-100 · Language selector in Settings

- **Milestone:** M20 — Internationalization
- **Status:** ready
- **Depends on:** OG-099, OG-067
- **References:** `docs/decisions/ADR-0009-i18n.md`, `src/components/SettingsWindow.tsx`

## Context

Once the message catalog exists (OG-099), the language has to be a user choice.
Settings (OG-067) is the natural place, and the choice should survive a restart
like the other preferences.

## Scope

- Add a **Language** field to Settings with the available locales (English,
  Spanish) and a system/default option.
- Persist the choice (the existing settings/config mechanism) and apply it
  immediately without a reload.
- Resolve the default from the system locale when the user has not chosen one.
- Keep the native window menu and the graph/log unaffected by the switch except
  for their visible strings.

## Acceptance criteria

- [ ] Changing the language re-renders the UI in that locale immediately.
- [ ] The choice persists across restarts; with "system", the OS locale decides
      and falls back to English.
- [ ] The selected language is reflected in Settings after a restart.
- [ ] Tests: store/persistence and a Settings interaction with the bridge
      mocked.
- [ ] Checks green.

## Out of scope

- Adding more locales (each is a catalog file, OG-099).
- Translating repository content, commit messages or diffs.
- Per-window languages; the setting is global.

## Technical notes

- Reuse the settings persistence already used by the other options instead of a
  new store field.
- Applying the locale must not remount the whole app or reload the window.

## Implementation notes

_(filled in when the ticket closes)_
