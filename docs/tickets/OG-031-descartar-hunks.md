# OG-031 · Descartar hunks y líneas (inversión por hunk)

- **Milestone:** M5 — Pulido (v2 de OG-006)
- **Estado:** done
- **Depende de:** OG-006, OG-009
- **Referencias:** ROADMAP.md

## Contexto

El stage/unstage parcial (OG-006) ya permite hunks y líneas en ambos sentidos, pero **descartar** cambios solo existe a nivel de fichero completo (File status). No hay forma de deshacer un trozo concreto del working tree sin descartar todo el fichero.

## Alcance

- Backend: `discard_selection` construye el parche de la selección desde el diff unstaged y lo aplica **invertido al working tree** (`git apply --reverse`), por stdin, sin tocar el index.
  - `HunkSelection::File` no se admite aquí: el descarte completo ya existe en File status.
- UI: botón **Discard hunk** junto a Stage hunk y **Discard N line(s)** cuando hay líneas seleccionadas, ambos con confirmación destructiva (mismo patrón que File status) y solo en el lado unstaged.
- Corrección asociada: con la vista invertida (**Reverse**) activa, las acciones de stage/unstage/discard se ocultan, porque los índices de hunk/línea pertenecen al parche invertido y no corresponden al diff que git re-lee en el backend.
- Tras descartar: se refresca el parche y el estado del working tree.

## Criterios de aceptación

- [x] Descartar un hunk elimina solo ese hunk y conserva el resto de cambios del fichero.
- [x] Descartar líneas seleccionadas conserva las no seleccionadas.
- [x] Cancelar la confirmación no ejecuta git.
- [x] Con Reverse activo no se ofrecen acciones de stage ni discard.
- [x] Tests: integración Rust, store, PatchView y DiffView.

## Fuera de alcance

- Descartar un fichero completo desde el diff (ya está en File status).
- Deshacer un descarte (no hay undo; la confirmación es la red de seguridad).
- Descartar cambios staged (para eso está unstage).

## Notas técnicas

- Reutiliza `worktree_diff_bytes` + `ParsedPatch::build`; solo cambia el aplicador (`apply_worktree_patch`, sin `--cached`).
- `git apply --reverse` sobre el working tree exige que el contenido coincida con el parche; si algo cambió entre medias, git falla y el error se muestra.
- La confirmación vive en `DiffView` (como en `StatusView`), no en el store.

## Notas de implementación (2026-09-18)

- Rust: `discard_selection` + `apply_worktree_patch` (sin `--cached`); los dos aplicadores (index y worktree) pasan `--unidiff-zero` porque un recorte por líneas puede dejar el borde del hunk sin contexto y git lo rechazaba. Anotado en `.ai/memory/git-quirks.md`.
- UI: botón **Discard hunk** en el parche y **Discard N line(s)** en la toolbar, ambos con confirmación destructiva; el descarte solo aparece en el lado unstaged.
- Corrección: con **Reverse** activo se ocultan stage/unstage/discard (los índices del parche invertido no corresponden al diff que el backend re-lee).
- Tests: 114 Rust (2 de integración) y 191 frontend (7 entre store, PatchView y DiffView).
- Cerrado el 2026-09-18 con CI verde (Frontend 27 s, Rust 2m11s) en el PR #28.
