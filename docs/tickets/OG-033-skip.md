# OG-033 · `--skip` en rebase y cherry-pick

- **Milestone:** M5 — Pulido (v2 de OG-019)
- **Estado:** done
- **Depende de:** OG-019, OG-021
- **Referencias:** ROADMAP.md

## Contexto

El banner de operaciones (OG-019) permite Abort y Continue, pero no **saltar** el commit conflictivo. En un rebase o cherry-pick con conflictos incómodos, la única salida es resolver o abortar.

## Alcance

- Backend: `repo_op_skip` ejecuta `--skip` sobre la operación activa (rebase, cherry-pick o revert), con `GIT_EDITOR=true`.
  - `merge` no tiene `--skip` en git: error claro indicando que hay que resolver o abortar.
  - Sin operación en curso: error.
- UI: botón **Skip** en el banner, visible solo si la operación no es un merge.
- Tras el skip se refrescan estado, status, refs, historial y `op_state`, igual que en Abort/Continue.

## Criterios de aceptación

- [x] Un cherry-pick en conflicto + Skip deja el repo limpio y sin ese commit aplicado.
- [x] Un rebase en conflicto + Skip continúa con el resto del plan.
- [x] Un merge en conflicto + Skip falla con un mensaje claro y no toca el repo.
- [x] Sin operación, Skip falla.
- [x] Tests: integración Rust, store y banner.

## Fuera de alcance

- `--quit`, skip selectivo de commits dentro de un rebase o reword del mensaje al saltar.
- Skip en merge (no existe en git).

## Notas técnicas

- `git cherry-pick --skip` y `git revert --skip` existen desde git 2.20; `git rebase --skip` es más antiguo. El mínimo del proyecto (2.34) cubre ambos.
- El nombre del verbo (`rebase`, `cherry-pick`, `revert`) sale de `RepoOpState::operation()`, el mismo que usan abort y continue.

## Notas de implementación (2026-09-18)

- Rust: `repo_op_skip` rechaza `merge` con `merge has no skip: resolve the conflicts or abort`; el comando `repo_op_skip` se registra junto a abort/continue.
- UI: botón **Skip** en el banner solo cuando la operación no es merge; el store `commit` añade `skipOp` con el mismo refresco que abort/continue y salida "Operation skipped".
- Tests: 117 Rust (3 de integración) y 202 frontend (2 de banner y 1 de store).
- Cerrado el 2026-09-18 con CI verde (Frontend 40 s, Rust 1m54s) en el PR #30.
