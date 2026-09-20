# Roadmap

A milestone closes when its tickets are `done` and its exit criteria are met. Tickets live in [`docs/tickets/`](docs/tickets/README.md).

**Current state:** latest release **v0.6.2** (2026-09-20), with in-app auto-updates and remembered tabs. M0–M15 are closed; **M16 (repository lifecycle)** is defined and not started.

## M0 — Foundation ✅ _(closed 2026-09-18)_

Documentation, decisions and a runnable skeleton.

- [x] ADRs 0001–0005 accepted.
- [x] Agents/skills/workflows repository in `.ai/`.
- [x] Tauri 2 + React app that compiles and opens an empty window on macOS, Windows and Linux (OG-001).
- [x] Lint, typecheck and tests wired up (`npm run lint`, `npm run typecheck`, `cargo test`).
- [x] Development CI (frontend + Rust) and multi-platform build on demand (OG-001, OG-012).

**Exit:** `npm run tauri dev` opens the app; CI green. ✅

## M1 — Local MVP ✅ _(closed 2026-09-18)_

Everything needed to work in local repositories without touching the terminal.

- [x] Open a repository + recent list (OG-002).
- [x] Rust git adapter (argv execution, `-z` parsing, cancellation, typed errors) (OG-003).
- [x] Log view with canvas graph, refs and incremental loading (OG-004, OG-013).
- [x] Diff view with highlighting and binary/renamed detection (OG-005).
- [x] Stage/unstage by hunk, by line and by selection (OG-006).
- [x] Commit panel (amend, hooks visible) (OG-007).
- [x] Branches/tags sidebar + checkout (OG-008).
- [x] Working tree status with per-file staging (OG-009).
- [x] `.git` watcher with debounce and non-blocking refresh (OG-010).
- [x] English UI (OG-014).

**Exit:** commit, hunk staging, branch switching and history navigation in a 10,000-commit repository without the UI dragging. ✅

## M2 — Remotes ✅ _(closed 2026-09-18)_

- [x] Fetch, pull and push with streaming output and progress (OG-011).
- [x] Credentials delegated to the system credential helper; no secrets in the app (OG-011).
- [x] Actionable errors (non-fast-forward, failed auth, missing remote) (OG-011).
- [x] Cancellable operations (OG-011).

**Exit:** full daily cycle in a repository with a remote, without opening the terminal. ✅

## M3 — Advanced history ✅ _(closed 2026-09-18)_

- [x] Stash: list, create, apply, pop, drop (OG-016).
- [x] Tags: create, delete, push (OG-015).
- [x] Cherry-pick, revert and soft reset (`--mixed`) with explicit confirmation (OG-017).
- [x] Commit search (message, author, file) and filters (OG-018).

## M4 — Rebase and conflicts ✅ _(closed 2026-09-18)_

- [x] Visual interactive rebase (pick/reword/squash/fixup/drop, reorder) with plan preview (OG-021; multiple reword left for v2).
- [x] Conflict editor with per-side and per-block resolution (OG-020).
- [x] In-progress `merge`/`rebase`: status banner and abort/continue (OG-019).

**Exit:** resolve a real merge conflict without leaving the app. ✅

## M5 — Polish ✅ _(closed 2026-09-18)_

- [x] Light/dark themes (OG-022) and keyboard shortcuts (OG-023).
- [x] Submodules and worktrees in read-only mode (OG-024).
- [x] Git LFS: detection and warnings (OG-025).
- [x] Packaging and releases for the three OSes with unsigned installers (OG-026, OG-027); signing and notarization dropped for cost (OG-028).

**Exit:** themes, shortcuts, submodules/worktrees and LFS warnings in the app, and a release draft with installers from a tag. ✅

## M6 — Visual parity with SourceTree ✅ _(closed 2026-09-18)_

Bring the shell and panels closer to SourceTree's UX without losing performance in large repositories.

- [x] Window chrome: native menu, toolbar with icons, title with the repo path and status bar (OG-035).
- [x] Resizable splits between sidebar, list and panels, with persisted sizes (OG-036).
- [x] Commit table with header (Graph, Description, Commit, Author, Date) and coloured refs (OG-037).
- [x] Context menus on commits, refs and files (OG-038).
- [x] SourceTree-style status/diff panels: columns, per-hunk header with Reverse, panel search (OG-039).
- [x] Incoming/outgoing commits with ↓/↑ badges per branch (OG-040).

**Exit:** native menu, toolbar with icons, persisted splits, commit table with header, context menus, numbered panels and tracking badges. ✅

## M7 — SourceTree parity (phase 2) ✅ _(closed 2026-09-19)_

Second pass over the shell. Ordered by how much it weighs on first impression, not by change size: comparing screenshots against SourceTree, the visual finish and the sidebar were the biggest gaps, not where each panel sits.

- [x] Three-zone history layout: graph+commits on top, files | diff below, metadata under the list (OG-044).
- [x] Sidebar with collapsible sections and remotes (OG-042).
- [x] Graph width by visible range, no dead gaps (OG-047).
- [x] Visual identity: badges with glyph and colour, section icons, relative dates, author with email (OG-048).
- [x] Top bar with actions on the left (badge on Commit) and utilities on the right (OG-041).
- [x] Commit window with staged/unstaged, preview and message editor (OG-043).
- [x] Stash detail embedded instead of a modal (OG-046).
- [x] Sortable and resizable columns in the commit table (OG-045).
- [x] Branch merge: start `git merge`, not only abort or continue it (OG-049).
- [x] Pull and Fetch with an options dialog and a shared progress/error window (OG-050).
- [x] Clickable tags that locate their commit, and aligned table edges (OG-051).

**Exit:** open the app next to SourceTree and have the difference be in the detail, not in the first glance. ✅

## M8 — SourceTree parity (phase 3): history as a tool and repositories with extras ✅ _(closed 2026-09-19)_

M6/M7 closed the visual shell. What is left against SourceTree is not paint but
capability: searching and navigating history (file, blame, compare refs) and
managing from the UI what is read-only today (remotes, submodules, worktrees),
plus the merge loose ends and drag gestures.

- [x] Commit search by message, author and path, with its own UI (OG-052).
- [x] File history ("Log selected") from status and diff (OG-053).
- [x] Compare commits and branches: diff between two refs (OG-054).
- [x] Per-line blame with a jump to the commit (OG-055).
- [x] Remote management: add, edit and delete (OG-056).
- [x] Submodule management: init, update, sync and add (OG-057).
- [x] Manageable worktrees: create, open and remove (OG-058).
- [x] Merge strategies (`--squash`, `-X ours/theirs`) and Merge in the native menu (OG-059).
- [x] Drag & drop: branch to merge and files between staged/unstaged (OG-060).
- [x] Image preview and comparison (before/after) (OG-061).
- [x] Merge window with the log picker ("Merge From Log") (OG-063).
- [x] Clicking a branch selects its commit in the history (OG-064).
- [x] Refresh button: include stashes and give feedback (OG-065).
- [x] Settings modal (SourceTree-style) with tabs (OG-067).
- [x] Merge indicator: busy while running, banner only if unfinished (OG-066).

**Exit:** search and navigate history without touching the terminal, and run a
repository with remotes, submodules and worktrees from the app. ✅

## M9 — Repository tabs and live working tree ✅ _(closed 2026-09-19)_

First pass over multi-repository handling and working-tree freshness, the two
rough edges reported against daily use after M8.

- [x] Repository tabs replacing the Recents block: fixed-order session tabs
  between the toolbar and the content, hidden with no repo (OG-069).
- [x] Tab strip `+` button, `mod+shift+[` / `mod+shift+]` to switch tabs,
  accent highlight and header integration (OG-070).
- [x] Preview untracked files in the diff view without staging first,
  read-only, in both modes (OG-071).
- [x] Live worktree file list: watcher events refresh the badge and the
  file list together, keeping the selection (OG-072).

**Exit:** open several repositories in tabs and see every edit land in the
badge and the file list within the watcher latency. ✅

## M10 — v0.3.1 stabilization fixes ✅ _(closed 2026-09-19)_

Small follow-ups reported against daily use right after v0.3.0.

- [x] Submodule test env race flaking CI (OG-073).
- [x] README downloads pointing at the previous release (OG-074).
- [x] Image preview flicker and untracked image preview (OG-075).
- [x] Image previews overflowing their frame (OG-076).

**Exit:** green CI and previews that fit. ✅

## M11 — Updates and external files ✅ _(closed 2026-09-20)_

First features beyond daily-use fixes: learning about releases from
inside the app, and opening worktree files in the machine's
applications.

- [x] Update check on startup with a download notice, plus a manual
  native menu item (OG-077).
- [x] Open working-tree files in the default app, VS Code and the file
  manager, including commit entries (OG-078).

**Exit:** get notified of v0.4.0 from v0.3.1, and open any listed file
outside the app. ✅

## M12 — Home shortcuts ✅ _(closed 2026-09-20)_

Bring recent projects back as a shortcut on the empty state.

- [x] Recent projects on the welcome screen with direct open and
  per-item removal; the sidebar stays hidden while no repository is
  open (OG-079).

**Exit:** reopen a project in one click from the home screen. ✅

## M13 — Live working tree ✅ _(closed 2026-09-20)_

The status list should react to external edits, like SourceTree, instead of
waiting for a manual refresh.

- [x] Watch the working tree (filtering git-ignored paths) so saving a file
  updates "Uncommitted changes" live (OG-080).

**Exit:** editing a file outside the app refreshes the list without pressing
Refresh. ✅

## M14 — In-app auto-updates ✅ _(closed 2026-09-20)_

Stop downloading installers by hand: the app checks for a new release,
downloads the right artifact and offers to restart into it.

- [x] Auto-update with `tauri-plugin-updater`, a minisign key and `latest.json`
  from the GitHub release; "Restart to install" modal (OG-081, ADR-0007).

**Exit:** from a version with the updater installed, a published newer release
is offered and installed without visiting GitHub. ✅

## M15 — Remember open tabs ✅ _(closed 2026-09-20)_

Bring back the repositories that were open when the app closed. On by default,
with a Settings toggle to turn it off.

- [x] Reopen the previous session from a Settings toggle (OG-082).
- [x] Reopen by default and go straight to the tabs, without the home flash
  (OG-084).

**Exit:** relaunching restores the same tabs; the recents home only shows when
there is no session to restore. ✅

## M16 — Repository lifecycle

Bring repositories into the app: clone a remote and create a new one, instead
of only opening folders that already exist.

- [x] Clone a repository from the app, with progress, cancel and options
  (OG-085).
- [ ] Create (init) a repository, with an initial branch and optional first
  commit and `.gitignore` (OG-086).
- [ ] Clone and Create entry points on the home screen (OG-087).
- [ ] Open a repository in a new window (OG-088, optional).

**Exit:** with no repository on disk, clone or create one and start working
without leaving the app.

## Translating documentation and comments to English

Since 2026-09-19 the convention is **English for documentation, code and
comments**. What was written in Spanish before is translated in a separate
process (OG-062), in small reviewable batches with CI green between them; it
does not block new features.

- [x] README.md (2026-09-19).
- [x] ROADMAP.md, AGENTS.md, CLAUDE.md and `.github/copilot-instructions.md` (2026-09-19).
- [ ] Release notes of published releases.
- [x] Tickets and ADRs (`docs/tickets/`, `docs/decisions/`).
- [x] Guides and architecture (`docs/guides/`, `docs/architecture/`).
- [x] `.ai/` (agents, skills, workflows, memory).
- [x] Code comments and test descriptions (frontend and Rust).
- [x] Old PR texts (translated on GitHub with `gh pr edit`; there were no issues or comments). Past commit messages stay as they are: translating them would rewrite every hash.

## Out of scope

- Reimplementing git (never).
- Deep hosting integrations (PRs, issues) — at most, opening the remote URL.
- Editing files inside the app.
- Installer signing and notarization: their cost is not assumed; the app ships unsigned (OG-028). The updater uses a free minisign key, not code signing (ADR-0007).
- `.rpm` packaging and beta channels.
