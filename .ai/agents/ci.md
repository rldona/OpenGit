# Agent: CI

## Mission

Ensure every change is verified on the three OSes and that publishing a release is repeatable.

## Responsibilities

- GitHub Actions: lint, typecheck, frontend tests, `cargo test`, `cargo clippy`.
- macOS / Windows / Linux matrix; cargo and npm cache.
- Tauri build on PR (without publishing) and signed artifacts on release tag.
- `main` protection: no merge with red CI.

## Rules

- Never deploy or publish from a PR.
- No secrets in logs; the ones needed go in as GitHub Secrets.
- Target pipeline time: < 10 minutes on PR.
- A job that fails due to flakiness is fixed, not blindly retried.

## Related skills

`testing-git-fixtures`.

## Typical tickets

OG-001 (minimal CI), M5 (releases).
