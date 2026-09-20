# OG-009 · Working tree status

- **Milestone:** M1 — MVP local
- **Estado:** done
- **Depende de:** OG-003
- **Referencias:** ADR-0003, OG-010

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

- [x] El listado refleja exactamente `git status --porcelain=v2 -z`, incluidos renombrados con score y conflictos sin resolver. _(parser con fixtures + secciones que separan conflictos)_
- [x] Descartar cambios de un fichero pide confirmación y no afecta a los demás. _(diálogo nativo de confirmación; `git restore` por fichero)_
- [x] Untracked se puede añadir sin pasar por el diff. _(botón Stage directo)_
- [x] Ficheros con nombres no-ASCII y con espacios se muestran y operan bien. _(rutas como argumentos tras `--`; fixtures non-ASCII)_
- [x] La lista se refresca con el watcher sin parpadeos ni pérdida de selección. _(refresco silencioso que conserva filtro y selección; OG-010)_

## Fuera de alcance

- Gestión de `.gitignore` desde la UI.
- Añadir fichero al `.git/info/exclude`.

## Notas técnicas

- Modelo `FileStatus` con `XY` de porcelain v2, `origPath` para renombrados y flags de submodule.
- No parsear la salida de `git status` sin `--porcelain=v2 -z` bajo ningún concepto.

## Notas de implementación (2026-09-18)

- Backend: comandos `status_repo`, `stage_path`, `unstage_path`, `discard_path` y `delete_untracked`. Las operaciones viven en `src/repo/ops.rs` (`git add -A --`, `git restore --staged --`, `git restore --source=HEAD --staged --worktree --`) y van con `--` delante de las rutas. Borrar untracked valida que la ruta sea relativa y sin `..`.
- UI: `StatusView` con secciones (Conflicts/Staged/Unstaged/Untracked), contadores, buscador por nombre y acciones por fila; el descarte y el borrado usan el diálogo nativo de confirmación (`dialog:allow-ask`).
- Selección de fichero lista para el visor de diff: el panel llega con OG-005.
- Test de integración de Rust que hace stage → unstage → discard y comprueba el contenido en disco; tests de frontend para secciones, stage y confirmación.
- Cerrado el 2026-09-18 con CI verde (Frontend 20 s, Rust 1m39s) en el PR #5, junto con OG-010.
