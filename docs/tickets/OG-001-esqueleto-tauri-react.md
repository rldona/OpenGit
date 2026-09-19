# OG-001 · Tauri 2 + React skeleton

- **Milestone:** M0 — Foundation
- **Status:** done
- **Depends on:** —
- **References:** ADR-0001, ADR-0002, ADR-0005

## Context

There is no code yet. Before implementing views, an app that compiles on the three OSes and a minimum of automated quality are needed.

## Scope

- Tauri 2 project with a React + TypeScript and Vite frontend.
- Base window layout: left sidebar, central area (graph/log) and bottom panel (output), without functionality.
- npm scripts: `dev`, `tauri`, `lint`, `typecheck`, `test`.
- ESLint + Prettier for the frontend; `rustfmt` + `clippy` for Rust.
- Vitest configured with a smoke test of the root component.
- GitHub Actions: macOS/Windows/Linux matrix with lint, typecheck, Rust tests and app build.

## Acceptance criteria

- [x] `npm run tauri dev` opens a window with the base layout on macOS. _(verified by starting the debug binary with the embedded layout)_
- [x] `npm run lint`, `npm run typecheck` and `npm run test` pass.
- [x] `cargo test` and `cargo clippy -- -D warnings` pass in `src-tauri`.
- [x] CI green on the three OSes. _(run 35319968720: Frontend 15 s, Rust 2m44s, macOS builds 5m20s, Ubuntu 3m56s, Windows 7m29s)_
- [x] Global state library decided (Zustand) and recorded in ADR-0005.

## Out of scope

- Any real git call.
- Definitive visual design, themes and shortcuts.

## Technical notes

- Planned structure: `src/` (React) and `src-tauri/` (Rust), described in `docs/guides/development.md`.
- Keep the Tauri 2 configuration with minimal capabilities; permissions are broadened when needed.
- Do not add heavy UI dependencies yet.

## Closing notes (2026-09-18)

- Versions: Tauri 2.11.5, React 19.1, Vite 8.3, TypeScript 6.0, Vitest 5, ESLint 10, Zustand 5.0, Rust 1.98.1.
- The only core command is `app_version`, which feeds the "core vX.Y.Z" indicator in the toolbar; it serves as an end-to-end test of the bridge.
- `tauri-plugin-opener` and `serde`/`serde_json` were removed from the template for being unused (rule 5 of AGENTS.md); they will come back when needed.
- The first CI failed with E401 because the lock pointed to the corporate Artifactory; fixed in `fix(ci): resolve package-lock against the public npm registry` (see `.ai/memory/dev-environment.md`).
- Node 20 deprecation warnings in the actions and migration of `ubuntu-latest`: fixed with `actions/checkout@v7`, `actions/setup-node@v7` and pinning to `ubuntu-24.04`.
