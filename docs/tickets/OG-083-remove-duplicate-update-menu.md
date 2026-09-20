# OG-083 · Remove the duplicate Check for Updates menu item

- **Milestone:** Next (post-M15)
- **Status:** done
- **Depends on:** OG-081
- **References:** `src-tauri/src/lib.rs`, `src/App.tsx`

## Context

The native **Check for Updates…** item was added twice: in the OpenGit app menu
and in the Help menu (OG-077). Once the updater landed (OG-081) the duplicate is
just noise; a single entry is enough.

## Scope

- Remove `check-updates-help` from the Help submenu in `build_menu`.
- Drop its routing case from `menuDispatch`.

## Acceptance criteria

- [x] **Check for Updates…** only appears in the OpenGit app menu.
- [x] The Help menu keeps Documentation and nothing else.
- [x] `cargo fmt --check`, `cargo clippy -D warnings`, `npm run typecheck`,
  `lint`, `test` green.

## Out of scope

- Adding a keyboard shortcut for the check.
- Moving the item between menus again.

## Implementation notes (2026-09-20)

- Rust: Help submenu now only builds the Documentation item.
- Frontend: `check-updates-help` removed from `menuDispatch`; the `check-updates`
  case is unchanged.
