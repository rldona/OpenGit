# OG-041 · Window top bar

- **Milestone:** M7 — SourceTree parity (phase 2)
- **Status:** done
- **Depends on:** OG-035, OG-044
- **Partially blocks:** OG-049 (the Merge button), OG-043 (target of the Commit button)
- **References:** ROADMAP.md, OG-035

## Context

OG-035 left a functional toolbar but with text buttons in a single row (`App.tsx:270-330`): Open repository, Fetch, Pull, Push, Refresh, Close, Output, help and a theme `select`. SourceTree separates repository actions (left, large icons with label) from utilities (right), and centers the repository name in the title bar.

## Scope

- Actions on the left: **Commit** (with badge of the number of pending changes), **Pull**, **Push**, **Fetch**, **Branch**, **Stash**.
- **Merge is out**: `git merge` does not exist in the backend. It is tracked as OG-049 and will be added to the bar when it closes.
- Utilities on the right: **View Remote**, **Show in Finder**, **Terminal**, **Settings**.
- Repository name centered; the full path remains as `title`.
- Commit navigates to the commit view; until it exists (OG-043) it points to the status view, which is where the commit panel lives today. Branch and Stash open their already existing flows.
- Extract the toolbar from `App.tsx` into its own component.
- Buttons disabled and with `aria-label` when there is no repo open or a remote operation is in progress.

## Acceptance criteria

- [x] Repository actions appear on the left with icon and label.
- [x] The Commit badge reflects the number of changes and disappears when there are none.
- [x] Utilities appear on the right and "Show in Finder" opens the system file manager.
- [x] The repo name is shown centered in the bar.
- [x] With no repo open only "Open repository" remains active.
- [x] The window title bar shows the repository path.
- [x] Tests: badge, disabled states and dispatch of each action.

## Out of scope

- Customizing which buttons are shown.
- Redesigning the native menu (OG-035 already covers it).
- Implementing `git merge` (OG-049).

## Technical notes

- "Show in Finder" and "Terminal" are platform-specific; a Rust command that resolves the program per OS instead of assuming `open` is advisable.
- "View Remote" can build on what was done in OG-034 (open the remote URL).
- The theme `select` moves to Settings; until Settings exists, keep it accessible.

## Implementation notes (2026-09-18)

- `Toolbar` extracted from `App.tsx`, which drops from 514 to ~330 lines. Three-column grid (`1fr auto 1fr`) so that the repo name is truly centered and not "centered according to what the buttons occupy".
- Buttons with icon above and label below (`ToolButton`), with the changes badge overlaid on the Commit icon.
- **Branch and Stash do not open new dialogs**: they emit a request through the UI store (`requestNewBranch` / `requestNewStash`) and the sidebar opens the form it already had, expanding its section. Avoids duplicating two creation flows.
- **Settings** did not exist as a screen. Instead of leaving a dead button, it opens a popover with the theme selector (which previously hung loose from the toolbar), the Output panel toggle, the shortcuts and close repository. It closes with Escape or by clicking outside.
- **Show in Finder** uses `revealItemInDir` from the opener plugin, with its permission added in `capabilities/default.json`. No new Rust.
- **Terminal** did need a Rust command (`open_terminal`): there is no cross-platform API. Per-platform candidates in order of preference and **always by argv**, never by shell: a repo named `foo; rm -rf ~` would be a textbook injection (rule 3).

### Bug found: the window title was never being set

`setWindowTitle` had been failing silently since OG-035. The default `core:window` permission includes `allow-title` (read) but **not `allow-set-title`** (write), and the `.catch(() => {})` in `App.tsx` swallowed the ACL error. OG-035's "title with the repo path" criterion was marked as met without being so.

- Added `core:window:allow-set-title` to `capabilities/default.json`.
- The `catch` is no longer silent: it sends the reason to the Output panel. Regression test included.
- Lesson for `.ai/memory/`: an empty `catch` over a Tauri IPC call hides ACL errors, which are not exceptional but configuration ones. If it swallows, let it be to Output.

### Out of this ticket

- **Merge** is not there: `git merge` does not exist in the backend. It is tracked as OG-049.
- **Commit** points to the status view as long as the dedicated view (OG-043) does not exist.
- Merging the title bar Electron-style (`titleBarStyle: Overlay`) was considered. **It was implemented and reverted**: see below.

### Discarded: merged title bar (`titleBarStyle: Overlay`)

The goal was to center the repository path in the title row, like SourceTree. The alignment of that row is decided by macOS and cannot be changed from Tauri with the native bar, so the only way was to draw it ourselves with `Overlay` + `hiddenTitle`.

It was fully implemented (window config with `trafficLightPosition`, Rust command `host_platform` to reserve space for the traffic lights only on macOS, `data-tauri-drag-region` and the `core:window:allow-start-dragging` permission) and **it was reverted by product decision**: the result was liked less than the native bar.

It remains noted in case someone retries it:

- The alignment of the native title **is not configurable**. Either the native bar as is, or draw it entirely.
- `core:window:allow-start-dragging` is **not** in the default `core:window` permission. Without it the drag region does nothing and does not warn: the same silent failure as `allow-set-title`.
- It requires platform detection, because on Windows and Linux `titleBarStyle` is ignored and the traffic-light gap would be left over. It was solved with a three-line Rust command (`std::env::consts::OS`) instead of adding `@tauri-apps/plugin-os` because of rule 5.
- The underlying drawback still stands: the window cannot be dragged when it is not focused ([tauri#4316](https://github.com/tauri-apps/tauri/issues/4316)).
