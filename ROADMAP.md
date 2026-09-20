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

## M2 — Remotos ✅ _(cerrado el 2026-09-18)_

- [x] Fetch, pull y push con salida en streaming y progreso (OG-011).
- [x] Credenciales delegadas al credential helper del sistema; nada de secretos en la app (OG-011).
- [x] Errores accionables (non-fast-forward, auth fallida, remoto ausente) (OG-011).
- [x] Operaciones cancelables (OG-011).

**Salida:** ciclo diario completo en un repo con remoto, sin abrir el terminal. ✅

## M3 — Historial avanzado ✅ _(cerrado el 2026-09-18)_

- [x] Stash: listar, crear, aplicar, pop, drop (OG-016).
- [x] Tags: crear, borrar, push (OG-015).
- [x] Cherry-pick, revert y reset suave (`--mixed`) con confirmación explícita (OG-017).
- [x] Búsqueda de commits (mensaje, autor, fichero) y filtros (OG-018).

## M4 — Rebase y conflictos ✅ _(cerrado el 2026-09-18)_

- [x] Rebase interactivo visual (pick/reword/squash/fixup/drop, reordenar) con vista previa del plan (OG-021; reword múltiple queda para v2).
- [x] Editor de conflictos con resolución por lado y por bloque (OG-020).
- [x] `merge`/`rebase` en curso: banner de estado y opción de abortar/continuar (OG-019).

**Salida:** resolver un conflicto real de merge sin salir de la app. ✅

## M5 — Pulido ✅ _(cerrado el 2026-09-18)_

- [x] Temas claro/oscuro (OG-022) y atajos de teclado (OG-023).
- [x] Submódulos y worktrees en modo lectura (OG-024).
- [x] Git LFS: detección y avisos (OG-025).
- [x] Empaquetado y releases para los tres SO con instaladores sin firmar (OG-026, OG-027); la firma y la notarización quedan descartadas por coste (OG-028).

**Salida:** temas, atajos, submódulos/worktrees y avisos LFS en la app, y borrador de release con instaladores desde un tag. ✅

## M6 — Paridad visual con SourceTree

Acercar el chasis y los paneles a la UX de SourceTree sin perder el rendimiento en repos grandes.

- [x] Chrome de la ventana: menú nativo, toolbar con iconos, título con la ruta del repo y barra de estado (OG-035).
- [x] Splits redimensionables entre sidebar, lista y paneles, con tamaños persistidos (OG-036).
- [x] Tabla de commits con cabecera (Graph, Description, Commit, Author, Date) y refs coloreadas (OG-037).
- [x] Menús contextuales en commits, refs y ficheros (OG-038).
- [x] Paneles de status/diff estilo SourceTree: columnas, cabecera por hunk con Reverse, búsqueda en el panel (OG-039).
- [ ] Commits entrantes/salientes con badges ↓/↑ por rama (OG-040).

## Fuera de alcance

- Reimplementar git (nunca).
- Integraciones profundas con hostings (PRs, issues) — como mucho, abrir la URL del remoto.
- Edición de ficheros dentro de la app.
- Firma y notarización de instaladores: su coste no se asume; se distribuye sin firmar (OG-028).
- Auto-updater, empaquetado `.rpm` y canales beta.
