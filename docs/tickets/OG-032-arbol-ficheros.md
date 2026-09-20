# OG-032 · Árbol de ficheros en diff y status

- **Milestone:** M5 — Pulido
- **Estado:** in-progress
- **Depende de:** OG-005, OG-009
- **Referencias:** ROADMAP.md

## Contexto

Las listas de ficheros de diff y de File status son planas. En repos con muchos ficheros anidados cuesta ver la estructura y localizar un directorio.

## Alcance

- Helper puro `buildFileTree`: a partir de rutas git (`a/b/c.txt`) construye nodos de directorio y fichero ordenados (directorios primero, luego alfabético), guardando en cada directorio todos sus ficheros descendientes para agregar contadores.
- Componente `FileTree` recursivo: directorios plegables (por defecto desplegados), indentación por nivel y render por callback del fichero (cada vista mantiene su fila y acciones).
- **DiffView**: selector **List / Tree**; en árbol, cada directorio muestra la suma de `+`/`-` de sus ficheros.
- **File status**: el mismo selector; el árbol se aplica dentro de cada sección (Conflicts, Staged, Unstaged, Untracked) manteniendo las acciones por fichero.
- La preferencia List/Tree vive en el store `ui` y se comparte entre ambas vistas.

## Criterios de aceptación

- [x] `buildFileTree` agrupa por segmentos, ordena directorios antes que ficheros y agrega descendientes.
- [x] Los directorios se pliegan y despliegan; al plegar se ocultan sus descendientes.
- [x] En diff, los contadores del directorio son la suma de sus ficheros.
- [x] En File status, los ficheros conservan sus acciones (Stage/Unstage/Discard/Delete) dentro del árbol.
- [x] Tests: helper, componente, y ambas vistas con el toggle.

## Fuera de alcance

- Vista de árbol en el sidebar de refs o en stashes.
- Arrastrar y soltar, multiselección o acciones por directorio.
- Persistir la preferencia entre reinicios.

## Notas técnicas

- Las rutas son las de git (`/`), no rutas de sistema; el helper separa por `/` y no toca disco.
- El estado plegado es local al componente (`Set<string>` de rutas de directorio); sobrevive a refrescos porque las claves son estables.
- El orden de las secciones de File status no cambia; el árbol solo reorganiza las filas de cada sección.

## Notas de implementación (2026-09-18)

- `lib/tree.ts`: `buildFileTree` genérico (directorios primero, luego alfabético; cada directorio guarda sus ficheros descendientes); un bug inicial perdía los ficheros de la raíz y lo cubren los tests.
- `FileTree`: recursivo, plegado local por ruta de directorio (sobrevive a refrescos), `renderFile` y `renderDirExtra` por callback.
- Diff y status comparten el toggle **List / Tree** del store `ui` (por defecto árbol); en modo árbol las filas muestran el nombre y el `title` conserva la ruta completa.
- Tests: 199 frontend (8 nuevos: helper, componente y toggle en ambas vistas); 114 Rust intactos (cambio solo de UI).
- Pendiente para cerrar: PR y CI verde.
