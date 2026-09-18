# OG-006 · Stage/unstage por hunks y líneas

- **Milestone:** M1 — MVP local
- **Estado:** in-progress
- **Depende de:** OG-005
- **Referencias:** skill `hunk-staging`, ADR-0003

## Contexto

Es la funcionalidad que más se usa en el día a día y la razón principal para no abrir el terminal: preparar commits parciales.

## Alcance

- Seleccionar hunks, líneas individuales o rangos y pasarlos al index.
- Unstage equivalente desde el diff staged.
- Stage/unstage de fichero completo.
- La UI de diff refleja el estado resultante sin recargar toda la vista.
- Manejo correcto de: CRLF, fichero sin newline final, EOF marker, ficheros nuevos y borrados, renombrados.

## Criterios de aceptación

- [x] Stagear un hunk actualiza el index (verificado con `git diff --cached`) sin tocar el working tree. _(test de integración con dos hunks)_
- [x] Stagear líneas sueltas dentro de un hunk produce el parche correcto, incluidos los bordes. _(test con la primera/última línea y conversión a contexto de las no seleccionadas)_
- [x] Unstage devuelve el contenido exacto al working tree. _(el index vuelve a HEAD y el fichero en disco no se toca)_
- [x] CRLF y ausencia de newline final no corrompen el fichero tras el stage. _(se comparan bytes con `git show :fichero` y con el disco)_
- [x] Nombres de fichero con espacios, comillas o UTF-8 funcionan. _(test con espacios y UTF-8; las comillas no son válidas en nombres de Windows y quedan cubiertas por el paso de argumentos)_

## Fuera de alcance

- Edición del contenido durante el stage.
- Stage interactivo histórico (`git add -p` guiado por consola).

## Notas técnicas

- Implementación por parches: reconstruir el hunk seleccionado, `git apply --cached -` (stdin) para stage y `git apply --cached --reverse -` para unstage. El parche se pasa por stdin, nunca por archivo temporal en el repo.
- Normalizar cabeceras del hunk (`@@ -a,b +c,d @@`) al recortar líneas; un offset mal calculado corrompe el parche.
- Test de integración obligatorio: repo temporal, stage parcial, verificar con `git diff --cached --numstat` y con el contenido leído de disco.
- La representación interna del hunk debe conservar el byte exacto de cada línea para no alterar el fichero.

## Notas de implementación (2026-09-18)

- `src/git/patch.rs`: parser y constructor de parches **en bytes** (`parse`, `ParsedPatch::build`). Selección: fichero, hunk (índice) o líneas (índices globales). Las líneas `-` no seleccionadas se convierten en contexto (si no, el parche no aplica); los `+` no seleccionados se omiten; los marcadores `\ No newline` solo se mantienen si su línea sigue. Los hunks sin cambios se descartan.
- Aplicación en `git::stage_selection` → `git apply --cached --recount --whitespace=nowarn -` por stdin, con `--reverse` para unstage; el fichero completo se resuelve con `git add -A --`/`git restore --staged --`.
- UI: en modo **unificado** el parche se pinta con `PatchView` (virtualizado): botón por hunk, selección de líneas `+`/`-` por clic y botones de fichero/como "Stage file"/"Stage N líneas". En commits el staging queda deshabilitado. Tras aplicar, se recarga solo el parche y se refresca el status.
- Tests: 5 de integración de staging (hunk, líneas, unstage, CRLF/sin newline, rutas) + 6 unitarios del parser; 54 de frontend.
- De paso se arregló una flakiness de los tests: los `TempDir` podían colisionar (mismo `pid+nanos` en tests paralelos) y ahora llevan contador atómico (ver `.ai/memory/dev-environment.md`).
- Pendiente para cerrar: PR y CI verde.
