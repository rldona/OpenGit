# OG-039 · Paneles de status/diff estilo SourceTree

- **Milestone:** M6 — Paridad visual con SourceTree
- **Estado:** in-progress
- **Depende de:** OG-038
- **Referencias:** ROADMAP.md

## Contexto

El visor de parches muestra las líneas sin numeración y con una cabecera de hunk que solo enseña el `@@…@@`; el panel de ficheros del diff no se puede filtrar. En SourceTree cada hunk lleva su rango y cada línea sus números antiguo/nuevo, y el panel de ficheros tiene búsqueda.

## Alcance

- Parser puro: `parseHunkHeader` (rangos antiguo/nuevo y sección) y `classifyPatchLines` con `oldLine`/`newLine` por línea (adds solo nuevo, deletes solo antiguo, contexto en ambos, marcadores sin número).
- `PatchView` con columnas de números de línea (antiguo y nuevo, monoespaciadas, alineadas a la derecha) y cabecera de hunk con etiqueta `Hunk N · Lines x–y` más las acciones existentes (Stage/Unstage/Discard) a la derecha.
- Buscador en el panel de ficheros del diff (filtra por ruta, insensible a mayúsculas, incluye `orig_path` de renombrados) con estado vacío "No files match".
- El filtrado no toca la selección ni el estado del store; solo lo que se pinta.

## Criterios de aceptación

- [x] Cada línea del parche muestra su número antiguo/nuevo cuando corresponde y queda vacío cuando no.
- [x] La cabecera de hunk muestra el índice y el rango nuevo, y mantiene las acciones de staging.
- [x] Escribir en el buscador del panel filtra los ficheros y "No files match" aparece si nada coincide.
- [x] Tests: parser (rangos y numeración), PatchView (columnas y etiqueta) y DiffView (filtro).

## Fuera de alcance

- Buscar dentro del propio parche.
- Control "Sorted by path" desplegable y otras ordenaciones.
- Numeración en el modo lado a lado (CodeMirror ya pinta sus gutters).

## Notas técnicas

- `parseHunkHeader` acepta el formato `@@ -a[,b] +c[,d] @@ sección` y devuelve `null` si no encaja; con conteos 0 se usa el inicio como única línea.
- La numeración se calcula en la misma pasada que la clasificación, así que mantenerla es O(n) sin estructuras extra.
- El buscador del diff es estado local (`useState`) y filtra `files` antes de pintar árbol o lista.

## Notas de implementación (2026-09-18)

- `parseHunkHeader` puro (`@@ -a[,b] +c[,d] @@ sección`) y `classifyPatchLines` con `oldLine`/`newLine` en la misma pasada; los marcadores `\ No newline` y las cabeceras quedan sin número.
- `PatchView`: columnas de números (40 px, mono, muted), etiqueta `Hunk N · Lines x–y` con la sección del header al lado y acciones de staging a la derecha.
- `DiffView`: input "Filter files" local que filtra por ruta y `orig_path`; estado "No files match" sin tocar la selección.
- Tests: 228 frontend (numeración del parser, etiqueta de hunk y filtro) y 120 Rust intactos.
- Pendiente para cerrar: PR y CI verde.
