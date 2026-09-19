# ADR-0001 · Desktop shell based on Tauri 2

- **Status:** accepted
- **Date:** 2026-09-18
- **Deciders:** Raúl López

## Context

OpenGit must run on Windows, macOS and Linux from a single codebase. The core
(running git, parsing, watching `.git`) is wanted in Rust. It is a personal
project: distribution cost matters less than iteration speed, but something
lightweight with no bundled runtime is desired.

## Decision

Use **Tauri 2** as the shell: the system webview for the UI and a Rust process
for the core, communicating through IPC (`invoke` and events).

## Alternatives considered

- **Electron** — mature ecosystem and no surprises, but it bundles Chromium and
  Node: >100 MB binaries and high RAM usage for an app that stays open all day.
- **Qt / C++ or Python** — maximum control, but a UI that is slower to iterate
  and two languages; the component ecosystem for diff/editors is poor compared
  to the web.
- **Flutter desktop** — good performance, but integration with Rust and with
  web code editors is worse; a less proven toolchain for this case.

## Consequences

- Binaries in the 10–20 MB range and fast startup.
- The webview differs per OS (WebView2 on Windows, WebKitGTK on Linux, WKWebView
  on macOS): **the UI must be verified on all three**, especially canvas
  rendering and shortcuts.
- Tauri 2 permissions and capabilities are declared explicitly: small attack
  surface, but more ceremony when adding plugins.
- Mixed debugging (webview DevTools + Rust logs) and a three-OS CI matrix from
  M0.
