# OG-030 · Diff de stash

- **Milestone:** M5 — Pulido (v2 de OG-016)
- **Estado:** in-progress
- **Depende de:** OG-016, OG-005
- **Referencias:** ROADMAP.md

## Contexto

El sidebar de stashes permite aplicar, pop y drop, pero no hay forma de ver qué contiene un stash antes de tocarlo.

## Alcance

- Backend: `stash_show` ejecuta `git stash show -p --include-untracked <ref>` (incluye los ficheros untracked guardados con `-u`) y valida la referencia como el resto de operaciones de stash.
- UI: botón **Diff** por stash que abre un diálogo con el parche completo en el editor de diff en modo unificado y solo lectura, con cierre.
- Estados del diálogo: cargando, error y "No changes in this stash".
- Sin aplicar el stash, sin staging y sin edición.

## Criterios de aceptación

- [x] Un stash con cambios tracked y untracked muestra ambos en el parche.
- [x] Una referencia inválida falla con `InvalidOutput` sin ejecutar git.
- [x] Cerrar el diálogo limpia la referencia y el parche.
- [x] Tests: integración Rust, store y sidebar.

## Fuera de alcance

- Lista de ficheros con diff por fichero y stage desde el stash.
- Comparar un stash con otra referencia o con la working tree.
- Editar el parche.

## Notas técnicas

- `--include-untracked` en `stash show` requiere git ≥ 2.32; el mínimo del proyecto es 2.34.
- El parche se muestra con `DiffEditor` (CodeMirror) en modo unificado; es el mismo componente del diff normal, sin acciones de staging.
- El estado del diff vive en el store de stash (`diffReference`, `diffPatch`, `diffLoading`, `diffError`) para que el sidebar y el diálogo no se acoplen.

## Notas de implementación (2026-09-18)

- Rust: `stash_show` reutiliza `validate_stash_reference`; test de integración con tracked + untracked y referencia inválida.
- Frontend: botón **Diff** en cada fila del sidebar, `StashDiffDialog` con `DiffEditor` unificado y solo lectura; estados cargando, error y "No changes in this stash".
- Tests: 112 Rust (2 nuevos) y 184 frontend (4 nuevos entre store y sidebar; se conservaron los tests previos del store al fusionar el fichero).
- Pendiente para cerrar: PR y CI verde.
