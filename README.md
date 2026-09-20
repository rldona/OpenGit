# OpenGit

Cliente de Git de escritorio, multiplataforma (Windows, macOS y Linux), inspirado en la UX de SourceTree: grafo de commits legible, diff con stage por hunks y panel lateral de branches, tags, remotes y stashes.

> Proyecto personal. Objetivo: tener las seis o siete vistas que se usan a diario, con el flujo de SourceTree pero sin su lentitud en repos grandes.

## Estado

**M3 completado** el 2026-09-18. Además del MVP local y los remotos, la app gestiona stash y tags, hace cherry-pick/revert/reset suave y permite buscar commits por mensaje, autor o fichero. El siguiente paso es M4 (rebase interactivo y resolución de conflictos).

| Área | Decisión | ADR |
| --- | --- | --- |
| Shell de escritorio | Tauri 2 (Rust) | ADR-0001 |
| UI | React + TypeScript | ADR-0002 |
| Motor git | binario `git` del sistema | ADR-0003 |
| Grafo de commits | canvas + carga incremental | ADR-0004 |
| Estado global | Zustand | ADR-0005 |

## Principios

1. **Git es la fuente de verdad.** No se reimplementa git: se orquesta el binario del sistema y se parsea su salida de forma robusta (`-z`, `--porcelain=v2`).
2. **La UI nunca se bloquea.** Las operaciones git corren en procesos separados con salida en streaming; el estado del repo se refresca con watch sobre `.git` + debounce.
3. **Un solo código para los tres SO.** Nada de codebases paralelos por plataforma.
4. **Si algo es raro, terminal.** Rebase interactivo visual y operaciones destructivas llegan tarde, con red de seguridad y nunca como único camino.

## Estructura del repositorio

```
opengit/
├── src/                       # React + TypeScript (UI)
├── src-tauri/                 # Rust (núcleo Tauri)
├── AGENTS.md                  # Instrucciones para agentes (opencode, Claude, etc.)
├── CLAUDE.md                  # Compatibilidad con Claude Code
├── CONTRIBUTING.md
├── README.md
├── ROADMAP.md
├── opencode.json              # Config de opencode: skills en .ai/skills
├── .github/
│   ├── workflows/ci.yml       # CI: frontend, Rust y build en los tres SO
│   └── copilot-instructions.md
├── .ai/
│   ├── agents/                # Roles especializados (git, diff, commit, CI...)
│   ├── skills/                # Capacidades reutilizables (SKILL.md)
│   ├── workflows/             # Procesos (nueva feature, ADR, release)
│   └── memory/                # Conocimiento adquirido
├── docs/
│   ├── architecture/          # Visión de componentes y flujos
│   ├── decisions/             # ADRs
│   ├── guides/                # Guías de desarrollo
│   └── tickets/               # Backlog, un fichero por ticket
└── LICENSE
```

## Documentación

- [ROADMAP.md](ROADMAP.md) — hitos M0–M5 y criterios de salida.
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
