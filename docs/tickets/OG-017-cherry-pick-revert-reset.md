# OG-017 · Cherry-pick, revert y reset suave

- **Milestone:** M3 — Historial avanzado
- **Estado:** in-progress
- **Depende de:** OG-004, OG-010
- **Referencias:** ROADMAP.md, AGENTS.md

## Contexto

Reescribir historia de forma controlada desde el grafo: traer un commit a la rama actual, deshacer uno ya publicado o mover la rama a un punto anterior sin perder los ficheros.

## Alcance

- Cherry-pick del commit seleccionado sobre la rama actual.
- Revert del commit seleccionado (crea el commit de reversión, con `--no-edit`).
- Reset suave (`--mixed`) de la rama actual al commit seleccionado: mueve HEAD y desestagea, sin tocar el working tree.
- Confirmación explícita en las tres acciones, con aviso especial en el reset.
- Errores de conflicto claros: el estado queda visible (banner de operación en curso) y el proceso no se queda a medias en silencio.

## Criterios de aceptación

- [x] Cherry-pick trae los cambios del commit y deja el mensaje original. _(test)_
- [x] Un cherry-pick en conflicto falla con error legible y deja el repo en estado cherry-pick (abortable desde el terminal; M4 añade la UI). _(test que aborta después)_
- [x] Revert crea un commit "Revert ..." que deshace el cambio. _(test)_
- [x] Reset mixed mueve la rama, mantiene los ficheros en disco y deja los cambios sin stage. _(test)_
- [x] Las tres acciones piden confirmación y refrescan grafo, refs y status. _(confirmación nativa + refrescos en el store y test de UI)_

## Fuera de alcance

- Reset `--hard` (destructivo; nunca por defecto).
- Cherry-pick de rangos o múltiples commits.
- Abort/continue desde la UI (llega con M4).

## Notas técnicas

- Comandos: `git cherry-pick <hash>`, `git revert --no-edit <hash>`, `git reset --mixed <hash>`.
- El hash se valida (hex, 4-64) antes de usarlo como argumento.
- Todas las operaciones pausan el watcher y refrescan al terminar.

## Notas de implementación (2026-09-18)

- Rust: `cherry_pick`, `revert_commit` y `reset_mixed` en `git/mod.rs` con validación de hash; comandos Tauri equivalentes con `pause_while`.
- UI: botones en el detalle del commit (Cherry-pick, Revert, Reset to here) con confirmación nativa y aviso específico en el reset; los errores salen en el panel de Salida y el banner de operación en curso (OG-007) avisa del cherry-pick a medias.
- Tras cada acción se refrescan log, refs y status (además del watcher).
- Tests: Rust (pick, conflicto, revert, reset mixed, hash inválido) y frontend (store y botones).
- Pendiente para cerrar: PR y CI verde.
