# Guía de desarrollo

> Estado: M0 en curso. El esqueleto Tauri 2 + React existe (OG-001); el adaptador de git llega con OG-003.

## Requisitos

- **Node.js 22+** y npm 10+ (la CI usa Node 24).
- **Rust estable** instalado con [rustup](https://rustup.rs), con `clippy` y `rustfmt`.
- **git 2.34+** en el PATH (el que usará la app).
- Dependencias de sistema para Tauri 2:
  - macOS: Xcode Command Line Tools.
  - Linux: `webkit2gtk-4.1`, `libayatana-appindicator3`, `librsvg2-dev`, `patchelf` (según distro).
  - Windows: WebView2 (preinstalado en Windows 11) y Visual Studio Build Tools con C++.

## Comandos

```bash
npm install               # dependencias del frontend
npm run tauri dev         # app en desarrollo
npm run tauri build       # binario de release

npm run lint              # ESLint
npm run format            # Prettier (escribe)
npm run format:check      # Prettier (verifica)
npm run typecheck         # tsc --noEmit
npm run test              # Vitest
npm run test:watch        # Vitest en modo watch

cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml
```

Build de prueba sin empaquetar (útil para validar sin firmar):

```bash
npm run tauri build -- --debug --no-bundle
```

### Builds multiplataforma a demanda

Los builds de macOS, Windows y Linux **no** corren en cada PR (cuestan minutos, sobre todo macOS). El PR solo pasa frontend + Rust en Ubuntu (~3 min). Los builds completos se lanzan a mano y suben el binario sin empaquetar como artefacto:

```bash
gh workflow run build.yml --ref main
gh run watch
```

Artefactos: `opengit-macos`, `opengit-linux`, `opengit-windows`.

## Estructura

```
src/                        # React + TS
  App.tsx                   # layout: toolbar, sidebar, historial, salida
  components/               # HistoryView, GraphCanvas, StatusView, DiffView
  lib/bridge/               # envoltorios tipados de invoke/eventos
  lib/diff/                 # separación del parche de git (OG-005)
  lib/graph/                # layout de lanes, puro y testeable (OG-004)
  lib/hooks/                # useRepoEvents (watcher → stores, OG-010)
  lib/stores/               # stores de Zustand (ui, repo, log, status)
  styles/                   # CSS global
  test/                     # setup de Vitest
src-tauri/                  # Rust
  src/lib.rs                # arranque de Tauri y estado de la app
  src/commands.rs           # comandos expuestos a la UI
  src/git/                  # runner y parsers (OG-003)
  src/repo/                 # apertura, recientes y operaciones (OG-002, OG-009)
  src/watch/                # watcher de .git (OG-010)
  tests/fixtures/           # salidas reales de git (strings)
  tests/                    # integración: runner, parsers, repo
```

## Flujo de trabajo

1. El ticket manda: crea o retoma un `OG-NNN` en `docs/tickets/`, ponlo `in-progress`.
2. Rama `feat/OG-NNN-slug`.
3. Implementa con tests; verifica con los comandos de arriba.
4. PR con `Closes OG-NNN`.

Detalle en [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Repos de prueba

Los tests crean sus propios repos temporales. Para uno manual y reproducible:

```bash
tmp=$(mktemp -d)
git -C "$tmp" init
git -C "$tmp" commit --allow-empty -m "root"
# ... generar commits, ramas, merges, renombrados, binarios, CRLF
```

Casos que conviene cubrir a mano al tocar parsers: repo vacío, detached HEAD, merge en curso, rename, fichero binario, CRLF, fichero sin newline final y nombres non-ASCII.

Los fixtures de los parsers viven en `src-tauri/tests/fixtures/` y se regeneran con `src-tauri/tests/fixtures/generate.sh` (ver su README).

## Problemas conocidos

- **Linux y WebKitGTK:** si la ventana sale en blanco, revisa las dependencias de sistema y los logs de `npm run tauri dev`; suele ser una versión de `webkit2gtk` desalineada.
- **macOS tarda la primera compilación de Rust:** normal; a partir de ahí son incrementales.
- **git que pide credenciales:** la app lanza con `GIT_TERMINAL_PROMPT=0`; si un comando falla por auth, configura el credential helper del sistema, no la app.
- **`npm ci` falla con E401 en CI:** el lock quedó resuelto contra un registry privado. Debe apuntar a `https://registry.npmjs.org`; el `.npmrc` del repo fuerza la normalización del host, pero al añadir dependencias conviene revisar que el lock no vuelva a quedar con URLs corporativas.
