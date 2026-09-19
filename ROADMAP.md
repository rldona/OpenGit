# Roadmap

A milestone closes when its tickets are `done` and its exit criteria are met. Tickets live in [`docs/tickets/`](docs/tickets/README.md).

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

## M8 — SourceTree parity (phase 3): history as a tool and repositories with extras

M6/M7 closed the visual shell. What is left against SourceTree is not paint but
capability: searching and navigating history (file, blame, compare refs) and
managing from the UI what is read-only today (remotes, submodules, worktrees),
plus the merge loose ends and drag gestures.

- [ ] Commit search by message, author and path, with its own UI (OG-052).
- [ ] File history ("Log selected") from status and diff (OG-053).
- [ ] Compare commits and branches: diff between two refs (OG-054).
- [ ] Per-line blame with a jump to the commit (OG-055).
- [ ] Remote management: add, edit and delete (OG-056).
- [ ] Submodule management: init, update, sync and add (OG-057).
- [ ] Manageable worktrees: create, open and remove (OG-058).
- [ ] Merge strategies (`--squash`, `-X ours/theirs`) and Merge in the native menu (OG-059).
- [ ] Drag & drop: branch to merge and files between staged/unstaged (OG-060).
- [x] Image preview and comparison (before/after) (OG-061).

**Exit:** search and navigate history without touching the terminal, and run a
repository with remotes, submodules and worktrees from the app.

## Translating documentation and comments to English

Since 2026-09-19 the convention is **English for documentation, code and
comments**. What was written in Spanish before is translated in a separate
process (OG-062), in small reviewable batches with CI green between them; it
does not block M8 or new features.

- [x] README.md (2026-09-19).
- [x] ROADMAP.md, AGENTS.md, CLAUDE.md and `.github/copilot-instructions.md` (2026-09-19).
- [ ] Release notes of published releases.
- [ ] Tickets and ADRs (`docs/tickets/`, `docs/decisions/`).
- [ ] Guides, architecture and `.ai/`.
- [x] Code comments and test descriptions (frontend and Rust).
- [ ] Old PR and issue texts (optional: they are edited on GitHub).

## Out of scope

- Reimplementing git (never).
- Deep hosting integrations (PRs, issues) — at most, opening the remote URL.
- Editing files inside the app.
- Installer signing and notarization: their cost is not assumed; the app ships unsigned (OG-028).
- Auto-updater, `.rpm` packaging and beta channels.
