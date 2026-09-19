# OG-038 · Context menus

- **Milestone:** M6 — Visual parity with SourceTree
- **Status:** done
- **Depends on:** OG-037
- **References:** ROADMAP.md

## Context

All actions require visible buttons or the detail panel. SourceTree concentrates per-element actions in right-click menus (commits, branches, tags, files).

## Scope

- `ContextMenu` component + `useContextMenu` hook: opens at the cursor position, closes on click outside, Escape or when choosing; `role="menu"`/`menuitem`, items with a `danger` variant, position clamped to the viewport and rendered in a portal.
- **Commits** (history): View diff, Cherry-pick, Revert, Reset to here, Interactive rebase from here, Copy hash. The actions are extracted into a `useCommitActions` hook shared with the detail panel (without duplicating logic or confirmations).
- **Refs**: branches (Checkout, Rename, Delete, Copy name), tags (Push, Delete, Copy name) and remote branches (Checkout, Copy name).
- **File status**: Open diff, Stage/Unstage, Discard (with confirmation), Delete untracked (with confirmation), Copy path.
- **Diff**: file list with Select, Stage/Unstage file and Copy path.
- `copyText` without new dependencies: `navigator.clipboard` with fallback to `document.execCommand`.

## Acceptance criteria

- [x] Right click on a commit opens the menu with the six actions and each one runs the same as the detail panel.
- [x] Right click on branches/tags/remotes opens their menu and destructive actions still ask for confirmation.
- [x] Right click on status/diff rows offers the element's actions and Copy path copies the path.
- [x] The menu closes with Escape, with a click outside and after choosing an item.
- [x] Tests: component, commit actions, refs and status.

## Out of scope

- Nested submenus, shortcuts shown in the menu and per-item icons.
- Native system menu for right click (HTML is used inside the WebView).
- Multi-selection or batch actions.

## Technical notes

- `useCommitActions` centralizes showDiff/cherry-pick/revert/reset/rebase with their confirmations; `CommitDetail` switches to using it.
- The menu lives in a portal to `body` with `position: fixed`; the hook returns `{ open, close, menu }` and each view renders `menu` once.
- The menu does not steal focus when opening (the items are buttons); Escape closes and clicking an item closes before running.

## Implementation notes (2026-09-18)

- `ContextMenu` (portal, `position: fixed` with viewport clamp) and `useContextMenu` hook in `lib/hooks/` (separated to respect `react-refresh/only-export-components`).
- `useCommitActions` centralizes show diff, cherry-pick, revert, reset and rebase with their confirmations; `CommitDetail` and the history menu share the hook.
- `copyText` without plugins: `navigator.clipboard` with fallback to `document.execCommand`.
- Menus: commits (6 actions), branches (Checkout/Rename/Delete/Copy name, Delete disabled on the current branch), tags (Push/Delete/Copy name), remote branches (Checkout/Copy name), status (Open diff/Stage or Unstage/Discard/Delete/Copy path) and diff (Select/Copy path).
- Tests: 224 frontend (3 menu, 3 integration) and 120 Rust untouched.
- Closed on 2026-09-18 with green CI (Frontend 36 s, Rust 2m16s) in PR #35.
