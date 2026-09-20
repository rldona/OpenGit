# OG-043 · Vista de commit dedicada

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** backlog
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

- [ ] El botón Commit de la barra abre la vista dedicada.
- [ ] Seleccionar un fichero en staged o unstaged muestra su diff en el preview.
- [ ] Stage/unstage desde esta vista actualiza ambas listas sin recargar toda la UI.
- [ ] Commit con mensaje vacío queda bloqueado y lo explica.
- [ ] Cancel vuelve a la vista previa conservando el mensaje en borrador.
- [ ] Tests: navegación, preview por selección, bloqueo por mensaje vacío y borrador conservado.

## Fuera de alcance

- Cambiar el flujo de hooks o amend (OG-007 ya lo cubre).
- Plantillas de mensaje de commit.
- Co-authors y trailers asistidos.

## Notas técnicas

- El borrador del mensaje ya vive en `useCommitStore`; Cancel solo debe cambiar de vista, nunca limpiarlo.
- La vista de status sigue existiendo: esta vista no la sustituye, la complementa.
