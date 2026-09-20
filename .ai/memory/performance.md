# Rendimiento

## Grafo: layout puro + canvas del viewport + filas virtualizadas

- **Fecha:** 2026-09-18
- **Contexto:** OG-004 exigía fluidez con 10 000 commits (el punto débil de SourceTree).
- **Decisiones que importan:**
  - El layout de lanes es una función pura e incremental (`src/lib/graph/layout.ts`) con estado que se pasa entre páginas; no se recalcula lo ya pintado.
  - Las lanes tienen **id** y el color vive en un mapa aparte (`colors`), de modo que una rama descubierta más tarde (su tip llega en otra página) repinta toda su línea sin mutar filas.
  - El canvas dibuja solo las filas del viewport (overscan de 1) y se repinta en cada scroll; la lista DOM solo monta ~viewport + 12 filas.
  - Test de 10 000 commits en una lane: el layout es lineal en el número de commits y pasa en milisegundos.
- **Implicación:** cualquier cambio debe mantener el layout incremental y no introducir trabajo por fila total. Si se añade un tercer tipo de borde, extender `GraphEdge.kind` en vez de duplicar lógica en el render.

## Diff con CodeMirror 6

- **Fecha:** 2026-09-18
- **Contexto:** OG-005; ficheros de miles de líneas sin bloquear la UI.
- **Diseño:** el parche de git se pide solo del fichero seleccionado; `splitPatch` lo divide en dos documentos para `MergeView` (lado a lado con colapso de tramos sin cambios) o se muestra tal cual con decoraciones por línea (unificado). Los lenguajes se cargan bajo demanda con `@codemirror/language-data`; si la extensión es desconocida, no se carga nada.
- **Hallazgo:** el bundle principal supera los 500 kB y Vite avisa (CodeMirror + descripciones de lenguajes). No rompe nada; si molesta, separar `DiffEditor` con `import()` dinámico para que el chunk del editor no cargue en la primera pintura.
- **Implicación:** no calcular diffs en el frontend; solo presentar el parche de git. El parche completo se conserva en el store para que OG-006 pueda trocearlo en hunks.
