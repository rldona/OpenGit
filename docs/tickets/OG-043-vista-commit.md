# OG-043 · Vista de commit dedicada

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** done
- **Depende de:** OG-044
- **Referencias:** ROADMAP.md, OG-007

## Contexto

`CommitPanel` vive dentro de la vista de status, compartiendo espacio con la lista de ficheros. En SourceTree, Commit es una pantalla propia: staged y unstaged arriba, preview del fichero seleccionado a la derecha, y el editor de mensaje abajo con Cancel/Commit.

## Alcance

- Nueva vista `commit` en `ViewName` (`ui.ts:5`).
- Layout: arriba split con **Unstaged** | **Staged**; a la derecha preview del fichero seleccionado; abajo el editor de mensaje.
- Pie con **Cancel** (vuelve a la vista anterior sin perder el mensaje escrito) y **Commit**.
- Reutilizar `CommitPanel` (amend, hooks) y los componentes de staging existentes; no reimplementar stage/unstage.
- El atajo de commit y la acción del menú nativo llevan a esta vista.

## Criterios de aceptación

- [x] El botón Commit de la barra abre la ventana de commit (File status).
- [x] Seleccionar un fichero en staged o unstaged muestra su diff en el preview.
- [x] Stage/unstage desde esta vista actualiza ambas listas sin recargar toda la UI.
- [x] Commit con mensaje vacío queda bloqueado y lo explica.
- [x] Cancel limpia el borrador (ver nota de implementación).
- [x] Tests: navegación, preview por selección, bloqueo por mensaje vacío.

## Implementación (2026-09-19)

La disposición final no es la del boceto de este ticket sino la de **SourceTree
real** (pantallas aportadas por el usuario al pedirlo): pending files con
Staged/Unstaged apilados a la izquierda (checkbox por fila, glifo de estado y
menú "⋯"), contenido del fichero a la derecha con staging por hunk, y abajo el
panel de commit con identidad de git, `Commit Options…` (amend), push
inmediato y Cancel/Commit. No hay una vista `commit` aparte de `status`: en
SourceTree la ventana de commit es esa pantalla, así que el botón Commit de la
barra lleva a File status.

Desviación: **Cancel limpia el borrador** en vez de volver a una vista previa,
porque no hay vista previa a la que volver; el mensaje vive en el store y el
usuario puede seguir escribiendo. Si algún día hay una vista anterior, ese
criterio se puede recuperar cambiando solo el handler del botón.

## Fuera de alcance

- Cambiar el flujo de hooks o amend (OG-007 ya lo cubre).
- Plantillas de mensaje de commit.
- Co-authors y trailers asistidos.

## Notas técnicas

- El borrador del mensaje ya vive en `useCommitStore`; Cancel solo debe cambiar de vista, nunca limpiarlo.
- La vista de status sigue existiendo: esta vista no la sustituye, la complementa.
