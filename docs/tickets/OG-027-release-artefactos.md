# OG-027 · Fix the release artifact upload

- **Milestone:** M5 — Polish (follow-up of OG-026)
- **Status:** done
- **Depends on:** OG-026
- **References:** ROADMAP.md

## Context

The first tag `v0.1.0` built the three bundles correctly, but the `release` job failed: `artifacts/*/*` also expands directories (`deb/`, `appimage/`, `msi/`, `nsis/`), and `gh release upload` / `gh release create` do not accept directories. The `v0.1.0` draft was left with only the `.dmg`.

## Scope

- Pass `gh` an explicit list of files (`find artifacts -type f`) in both paths: creating the draft and re-uploading with `--clobber`.
- Complete the `v0.1.0` draft with the real artifacts from the failed run using the fixed command, without rebuilding the bundles.
- Document that the fixed workflow will be validated on the next tag (the 3-OS matrix is not relaunched just to test the release job).

## Acceptance criteria

- [x] The `gh` arguments are only files, never directories.
- [x] The `v0.1.0` draft contains dmg, deb, AppImage, msi and exe.
- [x] No rebuild: the artifacts from run `35352127966` are reused.

## Out of scope

- Signing/notarization (phase 2 of OG-026).
- Relaunching the macOS/Windows bundles just to validate the fixed job.

## Implementation notes (2026-09-18)

- Cause: `upload-artifact` keeps subfolders (`deb/`, `appimage/`, `msi/`, `nsis/`), so `artifacts/*/*` expanded directories on the runner.
- Fix: explicit list with `find -type f -print0` and a bash array (compatible with bash 3.2), used in both paths (create and re-upload).
- Real verification without rebuilding: `gh run download 35352127966` and the same loop against the existing draft; the 5 artifacts remain. The fixed workflow will be validated end-to-end on the next tag.
- Closed on 2026-09-18 with green CI (Frontend 36 s, Rust 1m20s) in PR #23.
