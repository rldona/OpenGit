# Tauri

## `app_data_dir` for persisted state

- **Date:** 2026-09-18
- **Context:** persisting recent repositories (OG-002) without writing to the user's repo.
- **Finding:** `app.path().app_data_dir()` resolves to `~/Library/Application Support/<identifier>` on macOS (equivalents on Windows/Linux) and is the same path in dev and in release. The folder must be created before writing.
- **Implication:** `recent_repos.json` lives there via `AppState`; tests inject a temporary path into `Recents`, never the real one.

## Plugins require explicit permission in capabilities

- **Date:** 2026-09-18
- **Context:** native folder picker with `tauri-plugin-dialog`.
- **Finding:** without `dialog:allow-open` in `src-tauri/capabilities/default.json` the command compiles but `open()` fails at runtime with a permissions error.
- **Implication:** when adding a plugin, add to the capability the minimum permission used by the UI (not `*:default` for convenience).

## Opening external URLs: `tauri-plugin-opener` with scope

- **Date:** 2026-09-18
- **Context:** OG-034, opening the remote URL in the system browser.
- **Finding:** `window.open` would open a WebView window; the official way in Tauri 2 is `tauri-plugin-opener`. The permission supports per-URL scope: `{ "identifier": "opener:allow-open-url", "allow": [{ "url": "https://*" }, { "url": "http://*" }] }`; without it, the plugin compiles but fails at runtime. The Tauri build validates the capability at compile time.
- **Implication:** for external actions, use the plugin with a permission limited to the necessary scheme; never `opener:default` without scope if you only open web URLs.

## Core commands (`core:*`) also need permission, and they fail silently

- **Date:** 2026-09-18
- **Context:** OG-041; the title bar still said "OpenGit" with a repo open, even though `App.tsx` called `setWindowTitle(repo.root)` since OG-035.
- **Finding:** `core:default` does **not** include all core commands. In `core:window`, the default permission brings `allow-title` (read the title) but not `allow-set-title` (write it). Unlike plugins, here it's easy to assume `core:default` covers everything. The ACL error arrives as a rejection of the `invoke` promise, and a `.catch(() => {})` makes it invisible: the feature seemed implemented and had been dead for a whole milestone.
- **Implication:** two rules. (1) Check the specific permissions of `core:*`, don't trust `core:default`; they are listed in `src-tauri/gen/schemas/acl-manifests.json` under `default_permission.permissions`. (2) **Never silently swallow the error of an IPC call**: if it can't be handled, send it to the Output panel. An empty catch over `invoke` hides configuration errors, which are permanent, not sporadic.

## macOS arm64 needs a valid signature; configure ad-hoc signing

- **Date:** 2026-09-19
- **Context:** OG-068; the `v0.1.0` DMG's `OpenGit.app` could not be opened on an Apple Silicon Mac, even after removing the quarantine attribute.
- **Finding:** `codesign -dv` showed `flags=adhoc,linker-signed` and `Info.plist=not bound`, and the bundle had no `Contents/_CodeSignature`. `codesign --verify` failed with *"code has no resources but signature indicates they must be present"*: the linker signs the binary but does not seal the bundle resources. Tauri only re-signs the assembled bundle when `bundle.macOS.signingIdentity` is set.
- **Implication:** set `"macOS": { "signingIdentity": "-" }` (ad-hoc) so the DMG ships a valid signature; without it, arm64 refuses to launch the app. Ad-hoc does not remove Gatekeeper: users still right-click → Open or run `xattr -dr com.apple.quarantine`. To repair an already-installed copy: `codesign --force --sign - /Applications/OpenGit.app`.

