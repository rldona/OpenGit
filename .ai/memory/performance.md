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
