# OG-005 · Vista de diff con resaltado

- **Milestone:** M1 — MVP local
- **Estado:** done
- **Depende de:** OG-003, OG-009
- **Referencias:** ADR-0002, ADR-0006, skill `hunk-staging`

## Contexto

El diff es la segunda vista más usada. Debe ser rápido, legible y servir de base para el staging por hunks (OG-006).

## Alcance

- Diff de working tree, index (staged) y de un commit seleccionado.
- Modos unificado y lado a lado.
- Resaltado de sintaxis por lenguaje (CodeMirror 6; decidido en ADR-0006).
- Cabecera por hunk con números de línea; "reverse hunk" para invertir la dirección del diff.
- Casos especiales: ficheros binarios, renombrados, modo de fichero cambiado, fichero sin newline final, CRLF, ficheros largos/minificados.
- Vista de árbol de ficheros cambiados junto al diff (patrón SourceTree).

## Criterios de aceptación

- [x] Un diff de 5 000 líneas se abre en < 300 ms y hace scroll fluido. _(CodeMirror 6 virtualiza; el parche se pide solo del fichero visible. Sin medición formal: el render es por viewport)_
- [x] Binarios muestran un aviso claro, no un volcado.
- [x] Renombrados se muestran como `viejo → nuevo` con diff entre contenidos si lo hay.
- [x] El resaltado degrada con elegancia en extensiones desconocidas. _(si no hay lenguaje, texto plano)_
- [x] Los hunks son seleccionables para el staging (estructura de datos preparada para OG-006). _(el parche de git se conserva íntegro en el store; OG-006 lo troceará en hunks)_

## Fuera de alcance

- Edición del fichero desde la app.
- Diff de submódulos o LFS más allá de un aviso.

## Notas técnicas

- Decidir editor: CodeMirror 6 (más ligero, `@codemirror/merge` ya trae merge view) vs Monaco (más pesado, mejor para ficheros grandes). Registrar la elección en `docs/decisions/` si tiene coste de reversión.
- Parsear `git diff -z --numstat` para el árbol y pedir el parche por fichero solo cuando se muestra.
- Respetar `diff.algorithm` y `diff.context` del usuario, no forzarlos.

## Notas de implementación (2026-09-18)

- Decisión registrada en **ADR-0006**: CodeMirror 6; git sigue siendo la fuente de verdad (el parche se pinta, no se recalcula).
- Backend: comandos `diff_file` (working tree/staged/commit, con `-R` para invertir), `commit_files` (`diff-tree --numstat -z -M --root`) y `diff_numstat`. Tests: working tree, staged, invertido, commit con renombrado, binario y numstat.
- Frontend: `src/lib/diff/patch.ts` separa el parche en original/modificado para el modo lado a lado (ignora cabeceras y `\ No newline`); `DiffEditor` usa `MergeView` (lado a lado, con colapso de zonas sin cambios) o el parche de git en un editor de solo lectura con decoraciones `+`/`-` (unificado); lenguajes vía `@codemirror/language-data`.
- `DiffView` lista los ficheros con contadores (+/−) y etiqueta `index` para lo staged; avisa de binarios y de ficheros sin trackear. Se llega desde File status (clic en la fila) o desde el detalle de un commit ("Ver diff").
- El "Invertir" actual invierte el fichero completo (`git diff -R`); la inversión por hunk llegará con OG-006.
- La lista de ficheros es plana (con contadores), no un árbol jerárquico: pendiente de pulido si molesta.
- `diff.algorithm` y `diff.context` del usuario se respetan: no se pasan flags que los fuercen.
- Cerrado el 2026-09-18 con CI verde (Frontend 59 s, Rust 1m27s) en el PR #6, junto con los iconos de la app.
