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

## M6 — Paridad visual con SourceTree ✅ _(cerrado el 2026-09-18)_

Acercar el chasis y los paneles a la UX de SourceTree sin perder el rendimiento en repos grandes.

- [x] Chrome de la ventana: menú nativo, toolbar con iconos, título con la ruta del repo y barra de estado (OG-035).
- [x] Splits redimensionables entre sidebar, lista y paneles, con tamaños persistidos (OG-036).
- [x] Tabla de commits con cabecera (Graph, Description, Commit, Author, Date) y refs coloreadas (OG-037).
- [x] Menús contextuales en commits, refs y ficheros (OG-038).
- [x] Paneles de status/diff estilo SourceTree: columnas, cabecera por hunk con Reverse, búsqueda en el panel (OG-039).
- [x] Commits entrantes/salientes con badges ↓/↑ por rama (OG-040).

**Salida:** menú nativo, toolbar con iconos, splits persistidos, tabla de commits con cabecera, menús contextuales, paneles con numeración y badges de tracking. ✅

## M7 — Paridad SourceTree (fase 2) ✅ _(cerrado el 2026-09-19)_

Segunda pasada sobre el chasis. Ordenado por cuánto pesa en la percepción al abrir la app, no por tamaño del cambio: comparando capturas contra SourceTree, lo que más distancia marca es el acabado visual y la sidebar, no dónde está cada panel.

- [x] Layout de 3 zonas en el historial: grafo+commits arriba, ficheros | diff abajo, metadatos bajo la lista (OG-044).
- [x] Sidebar con secciones y remotos colapsables (OG-042).
- [x] Ancho del grafo por rango visible, sin huecos muertos (OG-047).
- [x] Identidad visual: badges con glifo y color, iconos de sección, fechas relativas, autor con email (OG-048).
- [x] Barra superior con acciones a la izquierda (badge en Commit) y utilidades a la derecha (OG-041).
- [x] Ventana de commit con staged/unstaged, preview y editor de mensaje (OG-043).
- [x] Detalle de stash embebido en lugar de modal (OG-046).
- [x] Columnas ordenables y redimensionables en la tabla de commits (OG-045).
- [x] Merge de ramas: iniciar `git merge`, no solo abortarlo o continuarlo (OG-049).
- [x] Pull y Fetch con diálogo de opciones y ventana de progreso/error compartida (OG-050).
- [x] Tags clicables que localizan su commit y bordes de la tabla alineados (OG-051).

**Salida:** abrir la app junto a SourceTree y que la diferencia esté en el detalle, no en el primer vistazo. ✅

## M8 — Paridad SourceTree (fase 3): el historial como herramienta y el repo con extras

M6/M7 cerraron el chasis visual. Lo que queda frente a SourceTree no es
pintura sino capacidad: buscar y navegar el historial (fichero, blame,
comparar refs) y gestionar desde la UI lo que hoy es solo lectura (remotos,
submódulos, worktrees), más los remates de merge y los gestos de arrastre.

- [ ] Búsqueda de commits por mensaje, autor y ruta, con UI propia (OG-052).
- [ ] Historial de un fichero ("Log selected") desde status y diff (OG-053).
- [ ] Comparar commits y ramas: diff entre dos refs (OG-054).
- [ ] Blame por línea con salto al commit (OG-055).
- [ ] Gestión de remotos: añadir, editar y borrar (OG-056).
- [ ] Gestión de submódulos: init, update, sync y add (OG-057).
- [ ] Worktrees gestionables: crear, abrir y eliminar (OG-058).
- [ ] Estrategias de merge (`--squash`, `-X ours/theirs`) y Merge en el menú nativo (OG-059).
- [ ] Drag & drop: rama para merge y ficheros entre staged/unstaged (OG-060).

**Salida:** buscar y navegar el historial sin tocar el terminal, y operar un
repo con remotos, submódulos y worktrees desde la app.

## Traducción al inglés de documentación y comentarios

Desde 2026-09-19 la convención es **inglés para documentación, código y
comentarios**. Lo escrito antes en español se traducirá en un proceso aparte,
en barridos pequeños y revisables, con CI en verde entre ellos; no bloquea M8
ni features nuevas.

- [x] README.md (2026-09-19).
- [ ] ROADMAP.md, AGENTS.md, CLAUDE.md y `.github/copilot-instructions.md`.
- [ ] Tickets y ADRs (`docs/tickets/`, `docs/decisions/`).
- [ ] Guías, arquitectura y `.ai/`.
- [ ] Comentarios de código y mensajes de test (frontend y Rust).
- [ ] Textos de PRs e issues antiguos (opcional: se editan en GitHub).

## Fuera de alcance

- Reimplementar git (nunca).
- Integraciones profundas con hostings (PRs, issues) — como mucho, abrir la URL del remoto.
- Edición de ficheros dentro de la app.
- Firma y notarización de instaladores: su coste no se asume; se distribuye sin firmar (OG-028).
- Auto-updater, empaquetado `.rpm` y canales beta.
