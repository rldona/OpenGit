# AGENTS.md

Instructions for any agent (opencode, Claude, Copilot, Codex) working in this repository. This is the single source: `CLAUDE.md` and `.github/copilot-instructions.md` only point here.

## Project

OpenGit is a cross-platform desktop Git client (Windows, macOS, Linux) inspired by SourceTree. Personal project, no external users yet. Scope and milestones live in `ROADMAP.md`; work starts from tickets in `docs/tickets/`.

## Architecture

```
React UI (WebView)  →  Tauri IPC (invoke/events)  →  Rust core  →  git binary
```

- **UI (React + TS):** graph/log, diff, staging, sidebar and output panel views. No git logic.
- **Rust core (`src-tauri`):** runs git, parses its output, watches `.git`, emits events to the UI.
- **Engine:** the system `git` binary. Git is never reimplemented.
- Full detail in `docs/architecture/overview.md`; decisions in `docs/decisions/`.

## Development

Current state: **M0–M19 closed**; latest release **v0.7.0** (2026-09-20), which adds the repository lifecycle: clone and create from the home screen (OG-085..OG-087), windows per repository (OG-088, ADR-0008), recovery: reflog/undo, bisect, reset modes and reverting merges (OG-089..OG-092) and history depth: worktree search, patches, word diff and cherry-pick ranges (OG-093..OG-096). After that, **M19** added full Git LFS (track/pull/migrate, OG-097) and a hooks manager (OG-098), and it is closed. The active milestone is **M20 (Internationalization)**: the i18n framework and Spanish locale (OG-099, ADR-0009) and the language selector in Settings (OG-100). In-app auto-updates use a free minisign key (OG-081, ADR-0007); signing and notarization are dropped for cost (OG-028). Scope for the next milestone starts from `ROADMAP.md`.

```bash
npm install
npm run tauri dev                # app in development
npm run lint                     # ESLint
npm run format:check             # Prettier
npm run typecheck                # tsc --noEmit
npm run test                     # Vitest
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

Conventions: **documentation, issues, code and comments in English** since 2026-09-19 (UI strings were already in English; UI internationalization will be decided later). **Everything written to git is in English**: commit messages, PR titles and descriptions, review comments and issue notes. Text written before in Spanish is translated in a separate process (OG-062), tracked in `ROADMAP.md`. Commits follow Conventional Commits with an area scope (`feat(graph): ...`). Every change starts from a ticket (`OG-NNN`).

## Rules

1. **Never run destructive operations without explicit confirmation** from the user: `reset --hard`, `push --force`, `clean -fd`, `branch -D`, `stash drop`.
2. **Never push** unless the user explicitly asks. **Commits:** one commit per ticket (`OG-NNN`) on completion — no partial, batch, or multi-ticket commits unless the user explicitly asks.
3. **Invoke git with argument arrays**, without a shell and without interpolating user input. `sh -c "git ... $VAR"` is forbidden.
4. **Robust parsing:** `-z`, `--porcelain=v2`, `--format` with separators. Never parse "human" or localized output.
5. **Do not add dependencies** without justifying it in the ticket or an ADR. Prefer std and what is already present.
6. **High-cost reversible decisions** → a new ADR. An accepted ADR is not edited; it is superseded.
7. **No secrets** in code, logs or tests. Credentials are handled by the system credential helper.
8. **No network operations in tests.** Git tests use temporary repositories created by the test itself.
9. Do not block the UI: no synchronous git calls on the interface thread.
10. If in doubt between "new feature" and "do not break what works": the latter first.
11. **Commit signing:** always `Raúl López <rldona@users.noreply.github.com>` (GitHub noreply). Never corporate emails or third-party identities; the repo sets `user.name`/`user.email` in its local config.
12. **One commit per ticket on completion:** when a ticket (`OG-NNN`) is finished, create a single commit with all its changes. Before committing, inspect `git status`, `git diff`, and `git log --oneline -10`; stage only intended files and never commit secrets. Message in English, Conventional Commits with area scope (`feat(graph): ...`).

## Testing

- **Parsers:** Rust unit tests with real output fixtures (strings), without touching disk or network.
- **Git integration:** temporary repositories (`git init` in `tempdir`) created and destroyed by the test. Cases: empty repo, detached HEAD, rename, binary mode, CRLF, missing trailing newline, non-ASCII.
- **Frontend:** Vitest + Testing Library, with the Tauri bridge mocked.
- **Performance:** reference test with a synthetic 10,000-commit repo; first paint < 500 ms and smooth scrolling.

## Documentation and agents

- `docs/architecture/` component view; `docs/decisions/` ADRs; `docs/guides/` practical guides.
- `.ai/agents/` specialized roles (git, diff, commit, stash, rebase, PR, CI...); `.ai/skills/` reusable capabilities; `.ai/workflows/` processes; `.ai/memory/` acquired knowledge.
- When you finish a task, if you discover something non-obvious about git, the platform or performance, note it in `.ai/memory/`.
- Skills in `.ai/skills/` load into opencode via `opencode.json` (`skills.paths`).
