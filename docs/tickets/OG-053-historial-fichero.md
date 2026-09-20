# OG-053 · Historial de un fichero

- **Milestone:** M8 — Paridad SourceTree (fase 3)
- **Estado:** ready
- **Depende de:** OG-009, OG-044
- **Referencias:** ROADMAP.md, OG-018

## Contexto

Ver el diff de un fichero es fácil, pero no hay forma de ver **su historia**:
qué commits lo tocaron. SourceTree lo ofrece como "Log Selected" desde el
árbol de ficheros y desde el propio diff. Hacia atrás solo se puede buscar a
mano commit a commit.

## Alcance

- "Show file history" en el menú contextual de ficheros de status, de los
  árboles de diff (status y detalle de commit) y del panel de parche.
- Modo de historial filtrado por ruta: la vista de History muestra una banda
  con la ruta activa y un botón para quitarla.
- Reutilizar el backend de búsqueda por ruta (`log_page` con `search.path`).

## Criterios de aceptación

- [ ] Desde un fichero modificado, "Show file history" abre el historial con
      solo los commits que lo tocaron, incluidos renames (`--follow` o
      equivalente documentado).
- [ ] La banda indica la ruta y permite volver al historial completo.
- [ ] Funciona igual desde un fichero del detalle de commit y del diff.
- [ ] La selección y el scroll se comportan como en el historial normal.
- [ ] Tests de store y de UI con el bridge mockeado.

## Fuera de alcance

- Blame (OG-055).
- Detección de copias (`-C`).

## Notas técnicas

- `logPage` ya acepta `search.path`; el trabajo es de contexto de vista: el
  filtro de ruta debe convivir con el de rama y sobrevivir a `reload`.
- Para renames, `git log --follow` no se puede combinar con todas las
  opciones del log actual: decidir y documentar el compromiso (probablemente
  `--follow` solo cuando hay ruta).
