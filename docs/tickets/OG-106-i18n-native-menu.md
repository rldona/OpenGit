# OG-106 · i18n: native menu and Rust user-facing strings

- **Milestone:** M20 — Internationalization
- **Status:** backlog
- **Depends on:** OG-099, OG-100
- **References:** `docs/decisions/ADR-0009-i18n.md`, `src-tauri/src/lib.rs`

## Context

The native application menu is built once in Rust (`build_menu`) with English
labels, and some user-facing text still originates in the core. Under ADR-0009
the backend stays language-neutral, so this is the last surface to align.

## Scope

- Rebuild the native menu when the locale changes: a command receives the active
  locale, and the menu item labels come from a catalog on the Rust side (or the
  frontend sends the label set).
- Keep item ids stable (`open-repo`, `fetch`, …) so `menu-action` routing does
  not change.
- Audit Rust strings that reach the UI directly (window title fallback, menu
  labels, operation names) and route them through either the menu catalog or
  the typed-error mapping (OG-105); never translate git's output.

## Acceptance criteria

- [ ] Switching the language updates the native menu without restarting.
- [ ] Menu ids and the `menu-action` payload are unchanged.
- [ ] No UI-visible hardcoded English left in `lib.rs` beyond brand names.
- [ ] Rust tests cover the label lookup; the frontend side is mocked.
- [ ] `cargo test`, `cargo clippy -D warnings`, `cargo fmt --check` and the
      frontend checks green.

## Out of scope

- Translating git output, commit messages or workflow logs.
- RTL layout and locales beyond `en`/`es`.

## Technical notes

- Menu labels live in two worlds; keep a single source of truth: the frontend
  catalog is authoritative and sends the labels, or a Rust table mirrors the
  locale union. Pick one and document it in the ticket.
- Rebuilding a menu on macOS requires setting it again on the app handle; verify
  it does not reset the About metadata or the shortcuts registered in Rust.

## Implementation notes

_(filled in when the ticket closes)_
