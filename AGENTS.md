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

Current state: **M8 in progress** (M7 completed on 2026-09-19 with SourceTree parity: commit window, embedded stash detail, remotes with dialog and progress window, sortable columns and merge; OG-052 commit search done). Pending in M8: file history, compare refs, blame and management of remotes, submodules and worktrees. Signing and notarization are dropped for cost (OG-028).

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
2. **Never commit or push** unless the user explicitly asks.
3. **Invoke git with argument arrays**, without a shell and without interpolating user input. `sh -c "git ... $VAR"` is forbidden.
4. **Robust parsing:** `-z`, `--porcelain=v2`, `--format` with separators. Never parse "human" or localized output.
5. **Do not add dependencies** without justifying it in the ticket or an ADR. Prefer std and what is already present.
6. **High-cost reversible decisions** → a new ADR. An accepted ADR is not edited; it is superseded.
7. **No secrets** in code, logs or tests. Credentials are handled by the system credential helper.
8. **No network operations in tests.** Git tests use temporary repositories created by the test itself.
9. Do not block the UI: no synchronous git calls on the interface thread.
10. If in doubt between "new feature" and "do not break what works": the latter first.
11. **Commit signing:** always `Raúl López <rldona@users.noreply.github.com>` (GitHub noreply). Never corporate emails or third-party identities; the repo sets `user.name`/`user.email` in its local config.

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
