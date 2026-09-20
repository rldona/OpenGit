# ADR-0007 · In-app auto-updates with tauri-plugin-updater

- **Status:** accepted
- **Date:** 2026-09-20
- **Deciders:** Raúl López

## Context

Until now the app could only *notice* a new release (OG-077: GitHub API check
plus a download link) and the user had to download and install the installer by
hand. The goal is the SourceTree/FlupCode flow: check on startup and from the
app menu, download the right artifact for the platform, and offer "Restart to
install".

OG-028 dropped installer signing and notarization and left the auto-updater out
of scope because "signing infrastructure" was assumed to be required. That
assumption is only half true:

- Code signing (Apple Developer, Windows certificate) is still out of scope.
- Tauri's updater does not need code signing; it verifies the update with a
  **minisign** key pair that is generated locally (`tauri signer generate`) and
  costs nothing.

The macOS bundle is already sealed with a valid ad-hoc signature (OG-068), which
is what the updater needs to replace the app bundle on Apple Silicon.

## Decision

Adopt **`tauri-plugin-updater`** (official Tauri 2 plugin) with a static
`latest.json` served from the GitHub release
(`https://github.com/rldona/OpenGit/releases/latest/download/latest.json`), and
a locally generated minisign key pair for update verification. The plugin is
driven from the frontend (`@tauri-apps/plugin-updater` plus
`@tauri-apps/plugin-process` for `relaunch`), and the notice is a custom React
modal consistent with the rest of the UI.

## Alternatives considered

- **Custom download-and-open-installer** (no plugin) — no signature
  verification, fragile per platform (`.dmg` cannot install itself), and it
  cannot replace a running app. Discarded.
- **Electron-style updater** — OpenGit is a Tauri app; irrelevant.
- **Keep the GitHub API banner and only link to releases** — the status quo
  (OG-077); it does not remove the manual download/install step.
- **Code signing plus updater** — would be more robust against Gatekeeper, but
  the project does not assume certificate cost (OG-028). Not required for the
  updater to work.

## Consequences

- A minisign private key becomes critical infrastructure: **if it is lost, the
  installed apps can no longer receive updates**. It lives only as a GitHub
  secret (`TAURI_SIGNING_PRIVATE_KEY` / `..._PASSWORD`) and in the maintainer's
  backup; the public key is committed in `tauri.conf.json`.
- The release workflow must build updater artifacts (`createUpdaterArtifacts`),
  sign them and publish a `latest.json` alongside the installers.
- The first release that ships the updater must be installed manually: the
  0.5.1 app has no updater, so auto-updates apply from that release onward.
- Platform support is limited by the build matrix and the installer type:
  Windows uses the NSIS installer and **the app quits automatically** when it
  installs; Linux updates the `.AppImage` (the `.deb` stays manual); macOS uses
  the re-signed `.app.tar.gz` and the app must be in a writable location (not
  running from the mounted DMG).
- Only the macOS architecture that the runner builds (arm64) is published as an
  updater platform today; Intel Macs keep the manual download until an x86_64
  build is added.
- This supersedes the "auto-updater out of scope" note of OG-028; that ticket
  remains valid for code signing, which is still dropped.
