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


## The updater pubkey is only checked when installing, and Windows exits during install

- **Date:** 2026-09-20
- **Context:** OG-081, in-app auto-updates with `tauri-plugin-updater` (ADR-0007).
- **Finding:** the plugin's config requires a `pubkey`, but it is only parsed when an update is downloaded/verified; `check()` and app startup work with a placeholder. Two platform behaviours matter: on Windows `install()` launches the NSIS installer and calls `std::process::exit(0)` (the app closes on its own, `relaunch` on the JS side never runs), while on macOS/Linux `install()` returns and the app must be relaunched with `@tauri-apps/plugin-process`. `createUpdaterArtifacts` also makes a plain local `tauri build` require `TAURI_SIGNING_PRIVATE_KEY`; `--no-bundle` does not.
- **Implication:** keep the check/download separate from install (download in the background, install on "Restart now") so Windows does not quit mid-session. Treat the minisign private key as unrecoverable infrastructure: losing it permanently breaks updates for installed users.

## `tauri build` on macOS: intermittent `failed to run xattr`

- **Date:** 2026-09-20
- **Context:** OG-081; a local `tauri build --bundles app` failed at "failed to remove extra attributes from app bundle: `failed to run xattr`".
- **Finding:** the bundler runs `xattr -crs <App>.app` before ad-hoc signing (`tauri-bundler` `bundle/macos/app.rs`). Its `output_ok()` treats any non-zero exit as `failed to run xattr` and swallows the real stderr (only visible with `-v`). On recent macOS the SIP-protected `com.apple.provenance` xattr can make `xattr -c` fail (EPERM) without Full Disk Access, and the attribute appears on freshly copied files, so the failure is intermittent. It is unrelated to the updater: it happens in the pre-existing signing step.
- **Implication:** retry the build, or grant the terminal Full Disk Access (System Settings → Privacy & Security). The release workflow runs on a clean macOS runner, so it is not expected there. To validate the minisign key/password without bundling, use `npm run tauri -- signer sign -f <key> -p <password> <file>`.

## Non-async commands run on the main thread

- **Date:** 2026-09-22
- **Context:** OG-109; switching repository tabs froze the UI on Ubuntu but felt fine on macOS.
- **Finding:** Tauri 2 dispatches `#[tauri::command]` functions that are **not** `async` on the application's main thread. On Linux that thread is the GTK event loop, so a `git status`/`log`/`for-each-ref` inside a command blocks painting and input. The same work was fast enough on macOS to go unnoticed.
- **Implication:** any command that spawns git or blocks on IO must be `async` and run its work through `tauri::async_runtime::spawn_blocking`. Resolve `State` from an `AppHandle` **inside** the blocking task: a `State` borrow cannot cross the await. Keep window/menu creation synchronous, since those must run on the main thread.
