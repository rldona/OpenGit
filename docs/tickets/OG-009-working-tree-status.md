# OG-009 · Working tree status

- **Milestone:** M1 — MVP local
- **Estado:** backlog
- **Depende de:** OG-003
- **Referencias:** ADR-0003

## Contexto

La vista de estado (inspirada en "File status" de SourceTree) responde a "qué ha cambiado" y permite moverse entre staged/unstaged/untracked.

## Alcance

- Lista plana de cambios con estado por fichero: staged, unstaged, untracked, renombrado, conflicto.
- Secciones: Staged / Unstaged / Untracked / Conflicts (si hay).
- Stage/unstage/descartar cambios de un fichero desde la lista (descartar con confirmación).
- Abrir el diff del fichero al seleccionarlo.
- Búsqueda/filtro por nombre.
- Contadores por sección.

## Criterios de aceptación

- [ ] El listado refleja exactamente `git status --porcelain=v2 -z`, incluidos renombrados con score y conflictos sin resolver.
- [ ] Descartar cambios de un fichero pide confirmación y no afecta a los demás.
- [ ] Untracked se puede añadir sin pasar por el diff.
- [ ] Ficheros con nombres no-ASCII y con espacios se muestran y operan bien.
- [ ] La lista se refresca con el watcher sin parpadeos ni pérdida de selección.

## Fuera de alcance

- Gestión de `.gitignore` desde la UI.
- Añadir fichero al `.git/info/exclude`.

## Notas técnicas

- Modelo `FileStatus` con `XY` de porcelain v2, `origPath` para renombrados y flags de submodule.
- No parsear la salida de `git status` sin `--porcelain=v2 -z` bajo ningún concepto.
