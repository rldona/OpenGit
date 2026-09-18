# Entorno de desarrollo

## En las sesiones de opencode, `node` no es Node

- **Fecha:** 2026-09-18
- **Contexto:** ejecutar `npm install` desde sesiones no interactivas en el Mac de desarrollo.
- **Hallazgo:** el PATH de la sesión antepone un shim de Bun (`/private/tmp/bun-node-*/node`) y no incluye Homebrew; `node --version` falla con un error del REPL de Bun. npm y cargo tampoco están en el PATH.
- **Implicación:** anteponer `export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"` en los comandos de shell. El Node real de Homebrew es la v26 y el de nvm está en `~/.nvm/versions/node`.

## Rust se instaló el 2026-09-18 con rustup

- **Fecha:** 2026-09-18
- **Contexto:** OG-001 requería compilar el núcleo Tauri; no había toolchain.
- **Hallazgo:** instalado Rust 1.98.1 con `--profile default` (incluye clippy y rustfmt) en `~/.cargo`.
- **Implicación:** usar `cargo` con `$HOME/.cargo/bin` en el PATH.

## npm 11 avisa de scripts de instalación sin aprobar

- **Fecha:** 2026-09-18
- **Contexto:** `npm install` en el proyecto.
- **Hallazgo:** npm avisa de que `fsevents` tiene un install script no aprobado (`allow-scripts`) y no lo ejecuta. No bloquea tests ni build.
- **Implicación:** si el HMR de Vite se comporta raro en macOS, aprobar el script con `npm approve-scripts`; no es necesario por ahora.
