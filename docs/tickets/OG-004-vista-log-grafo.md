# OG-004 · Vista de log con grafo

- **Milestone:** M1 — MVP local
- **Estado:** in-progress
- **Depende de:** OG-003
- **Referencias:** ADR-0004, skill `commit-graph-layout`

## Contexto

Es la vista principal y el mayor diferencial frente a SourceTree: mismo grafo, pero fluido en repos grandes.

## Alcance

- Lista de commits con columnas: grafo, refs, hash corto, autor, fecha y subject.
- Grafo en canvas: lanes, colores estables por rama, merge/branch de merges.
- Badges de refs: `HEAD`, rama local, rama remota, tag.
- Layout de lanes como función pura e incremental, testeada al margen del canvas.
- Carga paginada con scroll infinito (`--topo-order`, `--parents`, `--max-count`/`--skip`).
- Filtro por rama/ref y opción "todas las ramas" (incluir remotos).
- Selección de commit sincronizada con el panel de detalle.

## Criterios de aceptación

- [x] Repo de 10 000 commits: primera pintura < 500 ms y scroll sin tirones. _(layout de 10 000 commits cubierto por test; el render solo dibuja filas visibles + canvas del viewport. Medición visual pendiente en dev)_
- [x] El layout se verifica con unit tests que cubren merges, octopus, ramas huérfanas y root commit. _(7 tests en `src/lib/graph/layout.test.ts`)_
- [x] Los colores de una rama son estables entre refrescos y sesiones. _(color por nombre de ref con hash FNV; test de estabilidad)_
- [x] Cargar más commits no recalcula el layout ya pintado de forma errónea (sin saltos visuales). _(test incremental: paginar == una sola pasada)_
- [x] `devicePixelRatio` produce canvas nítido en pantallas HiDPI.

## Fuera de alcance

- Reordenar por fecha plana (solo topo-order por ahora).
- Búsqueda de commits (M3).
- Selección múltiple y rangos.

## Notas técnicas

- Las filas se renderizan en DOM virtualizado; el canvas es decorativo (`aria-hidden`) y la selección vive en la fila (ADR-0004).
- Fechas en formato relativo ("hoy 08:52", "ayer") calculadas en el frontend a partir de timestamp + offset del commit.

## Notas de implementación (2026-09-18)

- Backend: `log_page` acepta `rev: Option<&str>` (`--all` o `--end-of-options <rev>` para que una ref no se interprete como opción); comandos nuevos `log_page` y `list_refs`. Test de filtrado por rama.
- Layout (`src/lib/graph/layout.ts`): lanes con **id** propio y colores en un mapa aparte, así el color de una línea se resuelve al final de la página (una rama que se descubre al llegar a su tip no cambia de color a mitad). Soporta convergencia de lanes que esperaban el mismo commit.
- Render (`GraphCanvas`): canvas 2D solo del viewport, `devicePixelRatio`, nodos con anillo de selección y bordes `parent` (hacia abajo) y `converge` (hacia el nodo).
- Lista (`HistoryView`): virtualización propia por altura fija (28 px, overscan de 6), scroll infinito a falta de 12 filas, filtro de rama y panel de detalle del commit seleccionado.
- Pendiente para cerrar: PR y CI verde.
