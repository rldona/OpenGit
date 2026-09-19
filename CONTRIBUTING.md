# Contributing

Personal project, but with clear rules so the work (human or agent) is predictable.

## Flow

1. Every change starts from a ticket in `docs/tickets/`. If it does not exist, create it first.
2. The ticket moves to `in-progress` and work happens on a branch named after its ID: `feat/OG-004-graph-log`.
3. Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(graph): add incremental lanes`.
4. Before closing: lint, typecheck and tests green.
5. PR against `main` with the ticket ID in the title. The PR closes the ticket (`Closes OG-004`).

## Conventions

- **Language:** documentation, code, comments and everything written to git in English (see `AGENTS.md`; the Spanish written before is translated in OG-062).
- **Decisions:** any decision that is expensive to revert (heavy dependency, data model, UI↔Rust protocol) requires an ADR in `docs/decisions/` using `TEMPLATE.md`.
- **Tickets:** one file per ticket, format in `docs/tickets/README.md`. States: `backlog`, `ready`, `in-progress`, `blocked`, `done`.
- **Atomic commits:** one commit = one self-contained change. No "wip" on `main`.

## Code style

- Rust: `cargo fmt` + `cargo clippy` (no new warnings).
- TypeScript: `npm run lint` + `npm run typecheck`; functional components and hooks.
- No comments that restate the code. Comments explain *why*, not *what*.
- No secrets, tokens or personal paths in the repository.

## Sensitive git operations

The app must not run destructive operations without explicit user confirmation: `reset --hard`, `push --force`, `clean -fd`, `branch -D`, `stash drop`. In the development repository, the same rule applies to agents.
