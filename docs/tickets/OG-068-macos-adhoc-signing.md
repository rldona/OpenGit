# OG-068 · macOS bundle with a valid ad-hoc signature

- **Milestone:** M8 — SourceTree parity (phase 3), release fix
- **Status:** done
- **Depends on:** OG-026, OG-028
- **References:** README.md, `src-tauri/tauri.conf.json`

## Context

The `OpenGit.app` shipped in the `v0.1.0` DMG cannot be opened. The binary is
only linker-signed ad-hoc and the bundle has no
`Contents/_CodeSignature/CodeResources`, so `codesign --verify` fails with
*"code has no resources but signature indicates they must be present"* and
Gatekeeper rejects it as damaged or unverifiable. Removing the quarantine
attribute is not enough on Apple Silicon, where every binary must carry a valid
signature.

`tauri.conf.json` has no `bundle.macOS` section, so the Tauri bundler does not
re-sign the bundle after assembling it (the linker's signature does not seal the
bundle's resources).

## Scope

- Configure ad-hoc signing in the Tauri bundle so the generated `.app` has a
  valid signature (`bundle.macOS.signingIdentity = "-"`).
- Document in the README that macOS builds are ad-hoc signed (still require
  removing quarantine / right-click Open; they are not notarized).

## Acceptance criteria

- [x] `src-tauri/tauri.conf.json` configures ad-hoc signing.
- [x] The README's macOS installation note reflects ad-hoc signing.
- [x] A bundle signed this way passes `codesign --verify` and launches.

## Out of scope

- Developer ID signing and notarization (decision in OG-028).

## Technical notes

- Tauri 2 ad-hoc: `"macOS": { "signingIdentity": "-" }` in `bundle`.
- Verified locally on macOS 26 (arm64): after `codesign --force --sign -`
  the app reports *valid on disk*, satisfies its designated requirement and
  opens; the config change makes the bundler do exactly this at build time.
