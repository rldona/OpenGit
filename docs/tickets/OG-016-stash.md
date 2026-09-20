# OG-016 · Stash

- **Milestone:** M3 — Historial avanzado
- **Estado:** in-progress
- **Depende de:** OG-009, OG-010
- **Referencias:** docs/architecture/overview.md

## Contexto

El sidebar tiene un hueco de Stashes sin funcionalidad. Guardar y recuperar trabajo en curso sin miedo es parte del flujo diario.

## Alcance

- Listar stashes con mensaje, fecha y referencia.
- Crear stash (mensaje opcional, incluir untracked opcional).
- Aplicar (apply) y sacar (pop) con manejo de conflictos: si falla, el stash se conserva.
- Borrar (drop) con confirmación explícita.
- Refresco tras watcher y tras cada operación.

## Criterios de aceptación

- [x] Crear un stash deja el working tree limpio y aparece en el sidebar con su mensaje. _(test de Rust + UI)_
- [x] `--include-untracked` guarda también los ficheros sin trackear. _(test)_
- [x] Apply restaura los cambios sin borrar el stash; Pop lo aplica y lo borra. _(tests)_
- [x] Si apply/pop entra en conflicto, el error es claro y el stash sigue existiendo. _(test con conflicto real)_
- [x] Drop pide confirmación y solo entonces borra. _(confirmación nativa + test)_

## Fuera de alcance

- Previsualización del diff del stash (se valorará más adelante).
- Stash por hunks.

## Notas técnicas

- Listar: `git stash list --format=... -z` con separadores NUL.
- Crear: `git stash push [--include-untracked] [-m msg]`; aplicar: `git stash apply <ref>`; pop: `git stash pop <ref>`; borrar: `git stash drop <ref>`.
- La referencia se valida (`stash@{n}`) antes de usarla como argumento.

## Notas de implementación (2026-09-18)

- Rust: `stash_list`, `stash_push`, `stash_apply(drop)` y `stash_drop` con validación de referencia; comandos equivalentes que pausan el watcher.
- UI: `StashSidebar` sustituye el placeholder: crear (mensaje + incluir untracked), y por stash Apply / Pop / Drop con confirmación; refresco de refs/status/grafo tras cada operación.
- Tests: Rust (crear/lista/aplicar/pop/drop, untracked, conflicto conserva el stash) y frontend (store y sidebar).
- Pendiente para cerrar: PR y CI verde (comparte PR con OG-015).
