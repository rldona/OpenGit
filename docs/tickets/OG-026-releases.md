# OG-026 · Packaging and releases (phase 1: unsigned)

- **Milestone:** M5 — Polish
- **Status:** done
- **Depends on:** OG-012
- **References:** ROADMAP.md

## Context

`build.yml` generates development binaries on demand (`--no-bundle`), but there is no way to publish a release with installers. Signing and notarization require certificates (Apple Developer, Windows) that do not exist yet.

## Scope (phase 1)

- `release.yml` workflow triggered when pushing a `v*` tag (and manually with `workflow_dispatch` + tag).
- Bundles per OS:
  - macOS: `.dmg`
  - Linux: `.deb` and `.AppImage`
  - Windows: `.msi` and `.exe` (NSIS)
- Check that the tag matches the version in `package.json` and `tauri.conf.json`; if not, the workflow fails before compiling.
- GitHub release **as a draft**, with generated notes and all artifacts attached; the maintainer reviews and publishes.
- Re-runs: if the draft already exists, the artifacts are uploaded with `--clobber` instead of failing.
- Documentation of the flow in `docs/guides/development.md`.

## Acceptance criteria

- [x] The workflow only builds bundles on tags (`v*`) or manual dispatch; it does not run on every push.
- [x] A tag with a version different from `package.json`/`tauri.conf.json` fails with a clear message.
- [x] The workflow defines the attachment per OS (dmg validated locally; deb/AppImage/msi/exe pending the first tag).
- [x] The local unsigned bundle generates the path the workflow expects (`bundle/dmg/*.dmg`); the real run will be validated on the first tag.
- [x] No signing or notarization: documented as phase 2 (Apple/Windows certificates, universal binary, updater and rpm).

## Out of scope

- macOS and Windows signing/notarization, and universal binary (arm64 + x64).
- Auto-updater and beta channels.
- `.rpm` packaging (phase 2) and automatic publishing without review.

## Technical notes

- The work is split into a `build` job (3-OS matrix, uploads artifacts) and a `release` job (Ubuntu, downloads everything and creates the draft only once to avoid races).
- macOS minutes are billed 10×: that is why bundles are only built on tags, never on push.
- Explicit `--bundles` per platform so the result is deterministic (`dmg`; `deb,appimage`; `msi,nsis`).
- `CI=true` in the environment avoids signing attempts with the runner keychain.
- The app version lives duplicated in `package.json`, `tauri.conf.json` and `Cargo.toml`; the workflow validates the first two and the third remains as debt (automatic synchronization in phase 2).

## Implementation notes (2026-09-18)

- `.github/workflows/release.yml`: `build` job (3-OS matrix, `--bundles` per platform, artifacts) and `release` job (downloads everything and creates the draft once, with `--clobber` if it already exists).
- The version check was tested locally with `TAG=v0.1.0` (ok) and `TAG=v9.9.9` (fails with a message).
- macOS bundle validated unsigned (`CI=true npm run tauri build -- --bundles dmg`): aarch64 dmg in `bundle/dmg/`. The Linux/Windows flags were checked against `tauri build --help` (valid values per host).
- Pending validation on the first real tag: `.deb`, `.AppImage`, `.msi`, `.exe` and draft creation.
- Closed on 2026-09-18 with green CI (Frontend 36 s, Rust 1m43s) in PR #22. With this, M5 is complete except for the first release validation.
- Update (OG-028, 2026-09-18): signing/notarization is not a pending phase 2; it is dropped due to certificate cost and the installers are distributed unsigned.
