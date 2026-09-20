# Development guide

> Status: M8 in progress (M7 completed on 2026-09-19; OG-052 commit search done). See `ROADMAP.md`.

## Requirements

- **Node.js 22+** and npm 10+ (CI uses Node 24).
- **Stable Rust** installed with [rustup](https://rustup.rs), including
  `clippy` and `rustfmt`.
- **git 2.34+** on the PATH (the one the app will use).
- System dependencies for Tauri 2:
  - macOS: Xcode Command Line Tools.
  - Linux: `webkit2gtk-4.1`, `libayatana-appindicator3`, `librsvg2-dev`,
    `patchelf` (depending on the distro).
  - Windows: WebView2 (preinstalled on Windows 11) and Visual Studio Build
    Tools with C++.

## Commands

```bash
npm install               # frontend dependencies
npm run tauri dev         # app in development
npm run tauri build       # release binary

npm run lint              # ESLint
npm run format            # Prettier (writes)
npm run format:check      # Prettier (checks)
npm run typecheck         # tsc --noEmit
npm run test              # Vitest
npm run test:watch        # Vitest in watch mode

cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml
```

Test build without bundling (handy to validate without signing):

```bash
npm run tauri build -- --debug --no-bundle
```

### Multi-platform builds on demand

The macOS, Windows and Linux builds do **not** run on every PR (they cost
minutes, macOS especially). The PR only runs frontend + Rust on Ubuntu
(~3 min). Full builds are triggered by hand and upload the unbundled binary
as an artifact:

```bash
gh workflow run build.yml --ref main
gh run watch
```

Artifacts: `opengit-macos`, `opengit-linux`, `opengit-windows`.

### Releases

Installable bundles are only built when pushing a `vX.Y.Z` tag (macOS bills
at 10× per minute, so never on every push):

```bash
git tag -a v0.1.0 -m "OpenGit 0.1.0"
git push origin v0.1.0
```

The `release.yml` workflow:

1. Checks that the tag matches the version in `package.json` and
   `tauri.conf.json` (otherwise it fails before compiling).
2. Builds the bundles for the three OSes: `.dmg` on macOS; `.deb` and
   `.AppImage` on Linux; `.msi` and `.exe` (NSIS) on Windows.
3. Creates a **draft** release with the generated notes and the installers
   attached; review it on GitHub and publish it by hand.

No signing or notarization (project decision, OG-028): macOS and Windows will
warn when opening the installer. User instructions live in the README. To
re-run an already started release:
`gh workflow run release.yml -f tag=vX.Y.Z` (existing artifacts are replaced).

## Layout

```
src/                        # React + TS
  App.tsx                   # layout: toolbar, sidebar, history, output
  components/               # HistoryView, GraphCanvas, StatusView, CommitPanel, DiffView, RefsSidebar, StashSidebar, ExtrasSidebar, ConflictView, RebaseView, ShortcutsHelp
  lib/bridge/               # typed wrappers around invoke/events
  lib/conflict/             # conflict marker parsing (OG-020)
  lib/diff/                 # splitting the git patch (OG-005)
  lib/graph/                # lane layout, pure and testable (OG-004)
  lib/hooks/                # useRepoEvents (watcher → stores, OG-010)
  lib/stores/               # Zustand stores (ui, repo, log, status)
  styles/                   # global CSS
  test/                     # Vitest setup
src-tauri/                  # Rust
  src/lib.rs                # Tauri startup and app state
  src/commands.rs           # commands exposed to the UI
  src/git/                  # runner and parsers (OG-003)
  src/jobs/                 # fetch/pull/push in streaming (OG-011)
  src/repo/                 # opening, recents and operations (OG-002, OG-009)
  src/watch/                # .git watcher (OG-010)
  tests/fixtures/           # real git output (strings)
  tests/                    # integration: runner, parsers, repo
```

## Workflow

1. The ticket rules: create or resume an `OG-NNN` in `docs/tickets/`, set it
   to `in-progress`.
2. Branch `feat/OG-NNN-slug`.
3. Implement with tests; verify with the commands above.
4. PR with `Closes OG-NNN`.

Details in [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Test repositories

Tests create their own temporary repositories. For a manual, reproducible one:

```bash
tmp=$(mktemp -d)
git -C "$tmp" init
git -C "$tmp" commit --allow-empty -m "root"
# ... generate commits, branches, merges, renames, binaries, CRLF
```

Cases worth covering by hand when touching parsers: empty repo, detached
HEAD, merge in progress, rename, binary file, CRLF, file without a trailing
newline and non-ASCII names.

Parser fixtures live in `src-tauri/tests/fixtures/` and are regenerated with
`src-tauri/tests/fixtures/generate.sh` (see its README).

## Known problems

- **Linux and WebKitGTK:** if the window shows up blank, check the system
  dependencies and the `npm run tauri dev` logs; it is usually a mismatched
  `webkit2gtk` version.
- **macOS is slow on the first Rust build:** that is normal; after that they
  are incremental.
- **git asking for credentials:** the app launches with
  `GIT_TERMINAL_PROMPT=0`; if a command fails for auth, configure the system
  credential helper, not the app.
- **`npm ci` fails with E401 in CI:** the lockfile was resolved against a
  private registry. It must point to `https://registry.npmjs.org`; the repo's
  `.npmrc` forces host normalization, but when adding dependencies it is
  worth checking that the lock does not go back to corporate URLs.
