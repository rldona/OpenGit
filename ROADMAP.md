# Roadmap

Cada hito se cierra cuando sus tickets están en `done` y sus criterios de salida se cumplen. Los tickets viven en [`docs/tickets/`](docs/tickets/README.md).

## M0 — Fundación ✅ _(cerrado el 2026-09-18)_

Documentación, decisiones y esqueleto ejecutable.

- [x] ADRs 0001–0005 aceptados.
- [x] Repositorio de agentes/skills/workflows en `.ai/`.
- [x] App Tauri 2 + React que compila y abre una ventana vacía en macOS, Windows y Linux (OG-001).
- [x] Lint, typecheck y tests configurados (`npm run lint`, `npm run typecheck`, `cargo test`).
- [x] CI de desarrollo (frontend + Rust) y build multiplataforma a demanda (OG-001, OG-012).

**Salida:** `npm run tauri dev` abre la app; CI en verde. ✅

## M1 — MVP local ✅ _(cerrado el 2026-09-18)_

Todo lo necesario para trabajar sin tocar el terminal en repos locales.

- [x] Abrir repositorio + lista de recientes (OG-002).
- [x] Adaptador git en Rust (ejecución con argv, parseo `-z`, cancelación, errores tipados) (OG-003).
- [x] Vista de log con grafo en canvas, refs y carga incremental (OG-004, OG-013).
- [x] Vista de diff con resaltado y detección de binarios/renombrados (OG-005).
- [x] Stage/unstage por hunk, por línea y por selección (OG-006).
- [x] Panel de commit (amend, hooks visibles) (OG-007).
- [x] Sidebar de branches/tags + checkout (OG-008).
- [x] Working tree status con stage por fichero (OG-009).
- [x] Watcher de `.git` con debounce y refresco no bloqueante (OG-010).
- [x] UI en inglés (OG-014).

**Salida:** commit, stage por hunks, cambio de rama y navegación de historial en un repo de 10 000 commits sin que la UI se arrastre. ✅

## M2 — Remotos

- [ ] Fetch, pull y push con salida en streaming y progreso.
- [ ] Credenciales delegadas al credential helper del sistema; nada de secretos en la app.
- [ ] Errores accionables (non-fast-forward, auth fallida, remoto ausente).
- [ ] Operaciones cancelables.

**Salida:** ciclo diario completo en un repo con remoto, sin abrir el terminal.

## M3 — Historial avanzado

- [ ] Stash: listar, crear, aplicar, pop, drop.
- [ ] Tags: crear, borrar, push.
- [ ] Cherry-pick, revert y reset suave (`--mixed`) con confirmación explícita.
- [ ] Búsqueda de commits (mensaje, autor, fichero) y filtros.

## M4 — Rebase y conflictos

- [ ] Rebase interactivo visual (pick/reword/squash/drop) con vista previa del plan.
- [ ] Editor de conflictos con resolución por lado y por bloque.
- [ ] `merge`/`rebase` en curso: banner de estado y opción de abortar.

**Salida:** resolver un conflicto real de merge sin salir de la app.

## M5 — Pulido

- [ ] Temas claro/oscuro y atajos de teclado.
- [ ] Submódulos y worktrees en modo lectura.
- [ ] Git LFS: detección y avisos.
- [ ] Empaquetado y firma de releases para los tres SO.

## Fuera de alcance

- Reimplementar git (nunca).
- Integraciones profundas con hostings (PRs, issues) — como mucho, abrir la URL del remoto.
- Edición de ficheros dentro de la app.
