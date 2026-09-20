# Development environment

## In opencode sessions, `node` is not Node

- **Date:** 2026-09-18
- **Context:** running `npm install` from non-interactive sessions on the development Mac.
- **Finding:** the session PATH prepends a Bun shim (`/private/tmp/bun-node-*/node`) and doesn't include Homebrew; `node --version` fails with a Bun REPL error. npm and cargo aren't in the PATH either.
- **Implication:** prepend `export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"` to shell commands. The real Homebrew Node is v26 and the nvm one is in `~/.nvm/versions/node`.

## Rust was installed on 2026-09-18 with rustup

- **Date:** 2026-09-18
- **Context:** OG-001 required compiling the Tauri core; there was no toolchain.
- **Finding:** installed Rust 1.98.1 with `--profile default` (includes clippy and rustfmt) in `~/.cargo`.
- **Implication:** use `cargo` with `$HOME/.cargo/bin` in the PATH.

## npm 11 warns about unapproved install scripts

- **Date:** 2026-09-18
- **Context:** `npm install` in the project.
- **Finding:** npm warns that `fsevents` has an unapproved install script (`allow-scripts`) and doesn't run it. It doesn't block tests or the build.
- **Implication:** if Vite HMR behaves strangely on macOS, approve the script with `npm approve-scripts`; not necessary for now.

## The lockfile must not point to the corporate registry

- **Date:** 2026-09-18
- **Context:** first CI on GitHub Actions; the frontend job failed in 7 s with `npm error code E401`.
- **Finding:** this machine's `~/.npmrc` configures a corporate Artifactory, so `npm install` wrote the lock's 276 `resolved` URLs against that host. GitHub doesn't have (and shouldn't have) those credentials.
- **Implication:** `package-lock.json` must resolve against `https://registry.npmjs.org`. The repo's `.npmrc` pins `registry=https://registry.npmjs.org/` (npmjs is reachable from the development machine) so that any `npm install` writes public URLs.
- **Watch out with `replace-registry-host=always`:** it doesn't work as a fix. It only replaces the lock's **host** with the configured registry, but leaves the corporate path (`/artifactory/api/npm/...`), generating broken URLs in CI (404 instead of E401). It was tested and discarded.

## Commits use the GitHub noreply, not the corporate account

- **Date:** 2026-09-18
- **Context:** the repo history was created with the machine's global `user.email` (corporate account) and had to be rewritten.
- **Finding:** the repo had no identity of its own; `git config --global user.email` points to the company account. Author and committer were rewritten with `git filter-branch --env-filter` preserving dates, and `main` and the branches were force-pushed.
- **Implication:** the repo pins `user.name=Raúl López` and `user.email=rldona@users.noreply.github.com` in its local config; AGENTS.md requires it as rule 11. If any commit goes out with another email, it's fixed before pushing.

## Don't switch branches with `tauri dev` running

- **Date:** 2026-09-18
- **Context:** `npm run tauri dev` running while doing `git checkout main` + `git pull` (the pull rewrote the whole tree).
- **Finding:** Vite detected the change to `vite.config.ts`, restarted the server and ended up on port 5174 instead of 1420 (5173 was taken by another project), despite `strictPort`. The Tauri window kept loading `devUrl` (1420), which no longer responded → white screen. In the log: `Port 5173 is in use, trying another one...` and `Local: http://localhost:5174/`.
- **Implication:** don't checkout/pull with the dev server alive. If it happens: stop everything (`pkill -f "opengit/node_modules/.bin/vite"; pkill -f target/debug/opengit`) and relaunch `npm run tauri dev`, checking the log for `http://localhost:1420/` before considering the window good.

## Test TempDirs must be unique even if the clock repeats

- **Date:** 2026-09-18
- **Context:** parallel Rust integration tests; random failures of a different test on each run (detached HEAD, git errors, diffs).
- **Finding:** `TempDir::new` generated the name with `pid + nanos`; two threads could get the same `nanos` and share a folder, overwriting and deleting each other between tests.
- **Implication:** the name now includes an atomic counter (`AtomicU64`). If tests fail non-deterministically again, suspect shared resources first (temp dirs, ports, config files).

## `.trunk/` and vitest

- **Date:** 2026-09-18
- **Context:** suddenly `npm run test` collected 213 test files.
- **Finding:** a `.trunk/` directory appeared (Trunk linter plugins) with its own `*.test.ts`; vitest scanned them and they failed to load.
- **Implication:** `vite.config.ts` excludes `**/.trunk/**` (and `src-tauri`) and `.gitignore` ignores `.trunk/`. If hundreds of files show up in Vitest again, check the first unexpected directory.
