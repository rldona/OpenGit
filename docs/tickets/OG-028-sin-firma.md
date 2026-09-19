# OG-028 · Distribution without signing

- **Milestone:** M5 — Polish (distribution decision, after OG-026/OG-027)
- **Status:** done
- **Depends on:** OG-026
- **References:** ROADMAP.md, README.md

## Context

The first release (`v0.1.0`) was published unsigned. Signing/notarization requires paid certificates (Apple Developer, Windows) and the project will not assume that cost: installers are distributed unsigned permanently, not as a pending "phase 2".

## Scope

- Remove from ROADMAP, README, development guide and OG-026 any mention of signing as pending debt.
- Document the decision and its consequences in the README.
- Add installation instructions for unsigned builds:
  - macOS: Gatekeeper blocks the `.dmg`; open with right-click → Open or `xattr -cr /Applications/OpenGit.app`.
  - Windows: SmartScreen warns about the `.exe`/`.msi`; "More information" → "Run anyway".
  - Linux: `.deb`/`.AppImage` unchanged.
- Update the release `v0.1.0` notes with those instructions.

## Acceptance criteria

- [x] No doc presents signing as pending work; the decision is explicit.
- [x] The README explains how to install the unsigned bundles on the three OSes.
- [x] The `v0.1.0` release includes the installation notes.
- [x] The updater and `.rpm` packaging remain out of scope, not as phase 2.

## Out of scope

- Signing or notarizing (decision made: no).
- Auto-updater, rpm and beta channels.

## Implementation notes (2026-09-18)

- ROADMAP (M5 and out of scope), README (Status + Installation section), development guide and update note in OG-026.
- Release `v0.1.0`: notes edited with the macOS/Windows/Linux instructions.
- Documentation-only change: CI does not trigger (`paths-ignore` includes `**/*.md` and `docs/**`); merging the PR is the only gate.
