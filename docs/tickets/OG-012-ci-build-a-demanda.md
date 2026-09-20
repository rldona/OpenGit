# OG-012 · CI: separate PR validation and on-demand multi-platform build

- **Milestone:** M0 — Foundation
- **Status:** done
- **Depends on:** OG-001
- **References:** .github/workflows/ci.yml, .github/workflows/build.yml

## Context

Every push to the PR launched builds on macOS, Windows and Linux (~8 min of wall clock, with macOS billing at 10×). For UI, docs or test changes, waiting for the three artifacts is disproportionate.

## Scope

- `ci.yml` (development, on every PR and push to `main`): frontend + Rust only on Ubuntu. No matrix.
- `paths-ignore` so that changes that only touch documentation do not launch CI.
- `build.yml` (on demand, `workflow_dispatch`): macOS/Windows/Linux matrix with `--no-bundle` and artifact upload.
- Document how to launch it.

## Acceptance criteria

- [x] A code PR gives a signal in ~3 min (frontend + Rust). _(Frontend 15 s, Rust 3m21s)_
- [x] A docs-only PR does not launch CI. _(by design with `paths-ignore`; in a mixed PR the diff includes code and does launch the fast CI)_
- [x] `build.yml` is launched on demand and uploads the binary of each OS as an artifact. _(run 35322143811 on `main`)_
- [x] Development guide updated.

## Out of scope

- Artifact signing and full installers (M5).
- Automatic releases on tags and changelog (M5).

## Technical notes

- `actions/upload-artifact@v7` (node24), one artifact per OS: `opengit-macos`, `opengit-linux`, `opengit-windows`.
- The build uses Cargo's release profile (lto, strip), so it validates the real binary, not just `cargo check`.
- If required checks are ever enabled, review the `paths-ignore`: a workflow that does not trigger leaves the check waiting.

## Closing notes (2026-09-18)

- Verified with run 35322143811 of `build.yml` on `main`: the 3 OSes green and artifacts uploaded (`opengit-macos` 1.70 MB, `opengit-linux` 1.76 MB, `opengit-windows` 1.71 MB).
- Nuance observed: `paths-ignore` is evaluated on the full PR diff. A push that only touches docs inside a PR with code does not avoid the run; the filter only applies to documentation-only PRs (and to docs pushes to `main`).
- `workflow_dispatch` requires the workflow to be on the default branch, which is why verification was done after merging PR #1.
