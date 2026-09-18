# OG-019 · Estado de operaciones y Abort/Continue

- **Milestone:** M4 — Rebase y conflictos
- **Estado:** in-progress
- **Depende de:** OG-007, OG-017
- **Referencias:** ROADMAP.md

## Contexto

Hoy un merge, rebase, cherry-pick o revert a medias solo deja un aviso y el commit deshabilitado. Falta ver el estado de forma global y poder terminar o cancelar la operación desde la app.

## Alcance

- Detectar merge, rebase, cherry-pick y revert en curso, con el paso actual del rebase (p. ej. 2/5).
- Banner global visible en cualquier vista con la operación y el progreso.
- Botones **Abort** y **Continue**; Continue acepta el mensaje por defecto sin abrir editor.
- Errores claros si quedan conflictos sin resolver (Continue falla con el mensaje de git).
- Tras Abort/Continue se refrescan estado, status, refs y grafo.

## Criterios de aceptación

- [x] Un merge en conflicto muestra el banner y Abort lo cancela (repo como antes del merge). _(test)_
- [x] Continuar un merge tras resolver el conflicto crea el commit de merge. _(test)_
- [x] Abort de un rebase devuelve la rama al punto de partida; el banner muestra el paso. _(test con 1/1)_
- [x] Continuar un rebase tras resolverlo lo completa. _(test)_
- [x] Cherry-pick y revert en conflicto también se pueden abortar. _(test de cherry-pick; revert comparte REVERT_HEAD)_
- [x] Sin operación en curso, Abort/Continue fallan con un error claro (los botones no aparecen). _(test + banner oculto)_

## Fuera de alcance

- Editor de conflictos (siguiente ticket de M4).
- `--skip` en rebase/cherry-pick.

## Notas técnicas

- Estado en `.git`: `MERGE_HEAD`, `rebase-merge`/`rebase-apply` (+ `msgnum`/`end`), `CHERRY_PICK_HEAD`, `REVERT_HEAD`.
- Abort/Continue despachan al comando de la operación detectada; Continue se lanza con `GIT_EDITOR=true` para aceptar el mensaje por defecto.
- Todas las acciones pausan el watcher y refrescan al terminar.

## Notas de implementación (2026-09-18)

- Rust: `RepoOpState` gana `revert` y el progreso del rebase (`rebase_current`/`rebase_total`); `repo_op_abort` y `repo_op_continue` despachan según el estado y fallan con error si no hay operación.
- UI: `OpBanner` global (bajo la toolbar) con la operación, el paso y los botones Abort/Continue; el panel de commit ya no duplica el aviso.
- Tests: Rust (merge abort/continue, rebase abort/continue con progreso, cherry-pick abort, sin operación) y frontend (store y banner).
- Pendiente para cerrar: PR y CI verde.
