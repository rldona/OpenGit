# Arquitectura de OpenGit

## Vista general

```
┌──────────────────────────────────────────────────────────┐
│ React UI (WebView)                                       │
│  Sidebar · Grafo/Log · Diff · Staging · Panel de salida  │
└──────────────▲───────────────────────────────────────────┘
               │ invoke(cmd, args) / events (Tauri IPC)
┌──────────────┴───────────────────────────────────────────┐
│ Rust core (src-tauri)                                    │
│  commands · parsers · repo watcher · jobs cancelables    │
└──────────────▲───────────────────────────────────────────┘
               │ spawn(argv, sin shell)
┌──────────────┴───────────────────────────────────────────┐
│ binario git del sistema                                  │
└──────────────────────────────────────────────────────────┘
```

Principio rector: **la UI no sabe git**. Solo pinta modelos y lanza comandos. Toda la interacción con el repositorio ocurre en Rust.

## Componentes

### Frontend (`src/`)

- **Vistas:** grafo/log, detalle de commit, diff (working/staged/commit), panel de staging, sidebar (branches, tags, remotes, stashes), panel de salida.
- **Estado:** store por repositorio (repo abierto, refs, commits cargados, status, selección) y store global (recientes, preferencias, tema). La decisión de librería se toma en OG-001.
- **Bridge:** capa fina sobre `invoke` y `listen` con tipos generados a mano al principio; los modelos se comparten con Rust vía TypeScript types.
- **Sin reglas de negocio de git:** ningún comando se construye en la UI; se piden operaciones con nombre y parámetros validados en Rust.

### Core Rust (`src-tauri/`)

- **Comandos Tauri:** API pública hacia la UI (`open_repo`, `log_page`, `diff`, `stage_hunk`, `commit`, `checkout`, `fetch`, `push`...).
- **Runner de git:** lanza procesos con arrays de argumentos, entorno controlado, timeout y cancelación; devuelve `stdout`/`stderr`/exit code.
- **Parsers:** funciones puras por comando (`-z` / `--porcelain=v2` / `--format`), cubiertas con fixtures. Nunca parsean salida localizada ni "humana".
- **Watcher:** observa `.git` (HEAD, refs, index, MERGE_HEAD...) con debounce y emite eventos de "repo cambiado" a la UI.
- **Errores:** enum tipado (`GitError`) con mensaje para UI, exit code y stderr; la UI decide cómo presentarlo.

### Modelo de refresco

```
fs event en .git ──watch──► debounce (250 ms) ──► invalidar estado
                                                      │
UI pide datos ──invoke──► Rust ejecuta git ──► parsea ──► responde
                                                      │
eventos de progreso (fetch/pull/push) ──listen───────► panel de salida
```

- No hay polling: watch + debounce. Durante operaciones lanzadas por la propia app, el watcher se pausa para evitar tormentas de eventos.
- Las operaciones largas (fetch, pull, push, checkout gordo) emiten eventos de progreso y son cancelables.

## Modelo de datos mínimo

| Modelo | Origen git | Notas |
| --- | --- | --- |
| `Commit` | `git log --format=... -z` | hash, parents, autor, fecha, refs, subject |
| `FileStatus` | `git status --porcelain=v2 -z` | índice vs HEAD vs working tree |
| `FileDiff` | `git diff -z` + `--numstat` | hunks, binarios, renombrados |
| `Ref` | `git for-each-ref --format=... -z` | locales, remotas, tags |
| `Stash` | `git stash list --format=... -z` | mensaje, fecha, base |

## Rendimiento

- **Objetivo:** abrir un repo de 10 000 commits con primera pintura < 500 ms y scroll fluido (ver `ROADMAP.md` M1).
- Historial paginado y layout de lanes incremental (ADR-0004).
- Filas virtualizadas; el canvas solo dibuja el viewport.
- `git status` es la consulta más frecuente: cachear y refrescar solo con cambios del watcher.
- Presupuesto de errores: la UI nunca muestra un spinner infinito; todo comando tiene timeout y estado de error explícito.

## Seguridad

- Ejecución con `argv` separado; **prohibido** `sh -c` e interpolación de entrada del usuario.
- Rutas y refs se validan y se pasan como argumentos, nunca concatenadas.
- `GIT_TERMINAL_PROMPT=0`: si faltan credenciales, se falla con error claro en vez de quedarse colgado. Las credenciales las gestiona el credential helper del sistema (ADR-0003).
- Sin telemetría ni red propia: solo lo que haga el git del usuario.
