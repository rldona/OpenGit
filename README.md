<p align="center">
  <img src="assets/open-git-logo-trans.png" alt="OpenGit" width="140" />
</p>

<h1 align="center">OpenGit</h1>

<p align="center">
  Cliente de Git de escritorio para Windows, macOS y Linux, inspirado en la UX de SourceTree:
  grafo legible, stage por hunks y una sidebar con todo lo que se toca a diario.
</p>

<p align="center">
  <a href="https://github.com/rldona/OpenGit/actions/workflows/ci.yml"><img src="https://github.com/rldona/OpenGit/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/rldona/OpenGit/releases/latest"><img src="https://img.shields.io/github/v/release/rldona/OpenGit?label=release" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-informational" alt="Platforms" />
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri 2" />
</p>

<p align="center">
  <img src="assets/opengit-screenshot.png" alt="OpenGit mostrando el historial con grafo, ficheros y diff" width="100%" />
</p>

## Descarga

Los instaladores se publican en [Releases](https://github.com/rldona/OpenGit/releases/latest).

| SO | Descarga | Formato |
| --- | --- | --- |
| **Windows** | [OpenGit_x64-setup.exe](https://github.com/rldona/OpenGit/releases/download/v0.1.0/OpenGit_0.1.0_x64-setup.exe) · [OpenGit_x64.msi](https://github.com/rldona/OpenGit/releases/download/v0.1.0/OpenGit_0.1.0_x64_en-US.msi) | Instalador / MSI |
| **macOS** (Apple Silicon) | [OpenGit_aarch64.dmg](https://github.com/rldona/OpenGit/releases/download/v0.1.0/OpenGit_0.1.0_aarch64.dmg) | DMG |
| **Linux** | [OpenGit_amd64.deb](https://github.com/rldona/OpenGit/releases/download/v0.1.0/OpenGit_0.1.0_amd64.deb) · [OpenGit_amd64.AppImage](https://github.com/rldona/OpenGit/releases/download/v0.1.0/OpenGit_0.1.0_amd64.AppImage) | Debian / AppImage |

Los binarios **no están firmados ni notarizados** (los certificados son de pago y el proyecto no los asume), así que el sistema avisará al abrirlos:

- **macOS:** Gatekeeper bloquea la app. Abre el `.dmg`, arrastra OpenGit a Aplicaciones y ábrela con clic derecho → **Abrir**; si sigue bloqueada, `xattr -cr /Applications/OpenGit.app`.
- **Windows:** SmartScreen mostrará un aviso. Pulsa **Más información** → **Ejecutar de todas formas**.
- **Linux:** `.deb` con `sudo apt install ./OpenGit_*.deb` o `.AppImage` con permiso de ejecución.

## Características

- **Grafo de commits en canvas** con carga incremental: fluido en repos de decenas de miles de commits.
- **Diff con stage por hunk, por línea y por selección**, y descarte de cambios sin salir de la app.
- **Ventana de commit estilo SourceTree**: pending files con staged/unstaged, preview del fichero, `Commit Options…` (amend) y push inmediato opcional.
- **Sidebar completa**: branches, remotos, tags, stashes, submódulos y worktrees, con menús contextuales.
- **Operaciones de historial**: merge, cherry-pick, revert, reset y rebase interactivo con vista previa del plan.
- **Editor de conflictos por bloques** y banner de operación en curso (abortar, continuar, skip).
- **Remotos** con diálogo de opciones, progreso en streaming y cancelación; las credenciales las resuelve el credential helper del sistema.
- **Historial navegable**: filtro por rama, orden por columnas, búsqueda y fila de "Uncommitted changes".
- **Tema claro/oscuro** y atajos de teclado.

## Estado

**M7 completado** el 2026-09-19 (paridad con SourceTree: ventana de commit, stashes, remotos con diálogo, columnas ordenables y merge). **M8 planificado**: búsqueda, historial de fichero, comparar refs, blame y gestión de remotos, submódulos y worktrees. Detalle en [ROADMAP.md](ROADMAP.md).

## Stack

| Área | Decisión | ADR |
| --- | --- | --- |
| Shell de escritorio | Tauri 2 (Rust) | [ADR-0001](docs/decisions/) |
| UI | React + TypeScript | [ADR-0002](docs/decisions/) |
| Motor git | binario `git` del sistema | [ADR-0003](docs/decisions/) |
| Grafo de commits | canvas + carga incremental | [ADR-0004](docs/decisions/) |
| Estado global | Zustand | [ADR-0005](docs/decisions/) |

## Principios

1. **Git es la fuente de verdad.** No se reimplementa git: se orquesta el binario del sistema y se parsea su salida de forma robusta (`-z`, `--porcelain=v2`).
2. **La UI nunca se bloquea.** Las operaciones git corren en procesos separados con salida en streaming; el estado del repo se refresca con watch sobre `.git` + debounce.
3. **Un solo código para los tres SO.** Nada de codebases paralelos por plataforma.
4. **Si algo es raro, terminal.** Rebase interactivo visual y operaciones destructivas llegan tarde, con red de seguridad y nunca como único camino.

## Estructura del repositorio

```
OpenGit/
├── src/                       # React + TypeScript (UI)
├── src-tauri/                 # Rust (núcleo Tauri)
├── assets/                    # Logo y capturas
├── AGENTS.md                  # Instrucciones para agentes (opencode, Claude, etc.)
├── README.md
├── ROADMAP.md
├── .github/workflows/         # CI: frontend, Rust y build en los tres SO
├── .ai/                       # Agentes, skills, workflows y memoria
├── docs/
│   ├── architecture/          # Visión de componentes y flujos
│   ├── decisions/             # ADRs
│   ├── guides/                # Guías de desarrollo
│   └── tickets/               # Backlog, un fichero por ticket
└── LICENSE
```

## Documentación

- [ROADMAP.md](ROADMAP.md) — hitos y criterios de salida.
- [docs/tickets/](docs/tickets/README.md) — backlog con un fichero por ticket.
- [docs/architecture/overview.md](docs/architecture/overview.md) — componentes, flujo de datos y presupuesto de rendimiento.
- [docs/decisions/](docs/decisions/README.md) — ADRs.
- [docs/guides/development.md](docs/guides/development.md) — entorno, comandos y convenciones.
- [AGENTS.md](AGENTS.md) — reglas para agentes que trabajen en el repo.

## Arranque rápido

Requisitos: Node.js 22+ y Rust estable (ver [docs/guides/development.md](docs/guides/development.md)).

```bash
npm install
npm run tauri dev
```

## Licencia

MIT — ver [LICENSE](LICENSE).
