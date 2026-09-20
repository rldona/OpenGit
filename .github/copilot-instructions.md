# Copilot instructions

The single source of project instructions is [`AGENTS.md`](../AGENTS.md). Operational summary:

- OpenGit: cross-platform desktop Git client (Tauri 2 + Rust + React + TypeScript).
- The engine is the system `git` binary; git is never reimplemented.
- Documentation, code and comments in English; same for branches, commits and everything written to git (Conventional Commits).
- Every change starts from an `OG-NNN` ticket in `docs/tickets/`.
- Forbidden: destructive operations without confirmation, commits/pushes without being asked, interpolating input into a shell, parsing human-readable git output, secrets in the repository.
- Always parse with `-z` / `--porcelain=v2`. Git tests run against temporary repositories, never against the network.
- Decisions with a high cost to revert → ADR in `docs/decisions/`.
