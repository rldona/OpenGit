# OG-005 · Vista de diff con resaltado

- **Milestone:** M1 — MVP local
- **Estado:** backlog
- **Depende de:** OG-003
- **Referencias:** ADR-0002, skill `hunk-staging`

## Contexto

El diff es la segunda vista más usada. Debe ser rápido, legible y servir de base para el staging por hunks (OG-006).

## Alcance

- Diff de working tree, index (staged) y de un commit seleccionado.
- Modos unificado y lado a lado.
- Resaltado de sintaxis por lenguaje (CodeMirror 6 o Monaco; decidir en el ticket).
- Cabecera por hunk con números de línea; "reverse hunk" para invertir la dirección del diff.
- Casos especiales: ficheros binarios, renombrados, modo de fichero cambiado, fichero sin newline final, CRLF, ficheros largos/minificados.
- Vista de árbol de ficheros cambiados junto al diff (patrón SourceTree).

## Criterios de aceptación

- [ ] Un diff de 5 000 líneas se abre en < 300 ms y hace scroll fluido.
- [ ] Binarios muestran un aviso claro, no un volcado.
- [ ] Renombrados se muestran como `viejo → nuevo` con diff entre contenidos si lo hay.
- [ ] El resaltado degrada con elegancia en extensiones desconocidas.
- [ ] Los hunks son seleccionables para el staging (estructura de datos preparada para OG-006).

## Fuera de alcance

- Edición del fichero desde la app.
- Diff de submódulos o LFS más allá de un aviso.

## Notas técnicas

- Decidir editor: CodeMirror 6 (más ligero, `@codemirror/merge` ya trae merge view) vs Monaco (más pesado, mejor para ficheros grandes). Registrar la elección en `docs/decisions/` si tiene coste de reversión.
- Parsear `git diff -z --numstat` para el árbol y pedir el parche por fichero solo cuando se muestra.
- Respetar `diff.algorithm` y `diff.context` del usuario, no forzarlos.
