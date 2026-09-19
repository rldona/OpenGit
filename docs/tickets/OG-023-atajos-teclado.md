# OG-023 · Keyboard shortcuts

- **Milestone:** M5 — Polish
- **Status:** done
- **Depends on:** —
- **References:** ROADMAP.md

## Context

All actions require a mouse and there is no way to discover shortcuts. M5 includes keyboard shortcuts as part of the polish.

## Scope (v1)

- Global shortcut map (`mod` = Cmd on macOS, Ctrl elsewhere):
  - `mod+O` open repository; `mod+R` refresh status, refs and history.
  - `mod+Enter` commit (with message and staged files, same validation as the panel).
  - `mod+F` search history (switches to History and focuses the Message field).
  - `mod+1` File status, `mod+2` History, `mod+3` Diff.
  - `?` shortcut help; `Esc` closes the help or clears the selection.
- Built-in help: dialog with the shortcuts grouped by context; `?` button in the toolbar as a visible entry point.
- Shortcuts do not fire while typing in `input`, `textarea` or `select`; only those with `mod` go through text fields.
- `preventDefault()` on captured shortcuts (e.g. `mod+R` does not reload the WebView).

## Acceptance criteria

- [x] `mod+O`, `mod+R`, `mod+Enter`, `mod+F`, `mod+1/2/3` execute their action with the repository open.
- [x] `?` opens and `Esc` closes the help; `Esc` without help clears the selected commit.
- [x] The help dialog lists all the shortcuts with the correct platform label (⌘/Ctrl) and closes with the button.
- [x] Tests of the matcher (mod per platform, `?`, `Esc`, ignoring `Alt`), of the help and of the actions in App.
- [x] Typing a character that matches a shortcut in a text field executes nothing.

## Out of scope

- Customizing or reassigning shortcuts; importing keybindings from other clients.
- Command palette and graph navigation shortcuts (arrows, next/parent).
- Shortcuts with an intermediate state (leader keys or sequences).

## Technical notes

- `src/lib/shortcuts.ts` pure: definition of `SHORTCUTS`, `matchesShortcut` and `formatKeys`; `src/lib/hooks/useShortcuts.ts` registers a single global listener with an editable-field guard and handlers in a ref.
- The help is `src/components/ShortcutsHelp.tsx` and is controlled from the `ui` store (`shortcutsOpen`), with a `searchFocusRequest` counter for the `mod+F` focus without coupling components through the DOM.
- Commit: the staged count is shared with `CommitPanel` (`stagedEntries` and `hasActiveOperation` exported from `stores/commit.ts`).
- Refresh: log `reload` + status and refs `refresh`.

## Implementation notes (2026-09-18)

- `shortcuts.ts` defines the full map (`SHORTCUTS`), `matchesShortcut` (mod per platform, ignores `Alt`) and `formatKeys` (⌘ on macOS, Ctrl elsewhere); `navigator.platform` is used.
- `useShortcuts` registers a single listener on `document` with the handlers in a ref so as not to re-subscribe; in editable fields only shortcuts with `mod` pass.
- The help is `ShortcutsHelp` on top of `ui.shortcutsOpen`; `mod+F` uses `searchFocusRequest` so that `HistoryView` focuses the field without coupling through the DOM.
- While at it, `CommitPanel` reuses `stagedEntries`/`hasActiveOperation` instead of duplicating the filter.
- Tests: 161 frontend (7 for the matcher and formatting, 7 for the actions and help in App), 97 Rust untouched.
- Closed on 2026-09-18 with green CI (Frontend 27 s, Rust 1m44s) in PR #19.
