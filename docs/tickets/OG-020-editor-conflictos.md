# OG-020 · Editor de conflictos por bloques

- **Milestone:** M4 — Rebase y conflictos
- **Estado:** in-progress
- **Depende de:** OG-005, OG-019
- **Referencias:** ROADMAP.md

## Contexto

Con el banner de operaciones (OG-019) ya se puede abortar o continuar, pero resolver un conflicto obliga a editar el fichero a mano. Falta una vista que muestre los bloques en conflicto y permita elegir un lado por bloque.

## Alcance

- Lista de ficheros en conflicto (los `unmerged` de `git status`).
- Vista por bloques leyendo los marcadores del fichero de trabajo (`<<<<<<<`, `=======`, `>>>>>>>` y `|||||||` si el usuario usa `diff3`).
- Por bloque: **Take ours**, **Take theirs** y **Take both**, con opción de deshacer la elección.
- Bloques comunes mostrados como contexto.
- Guardar y hacer `git add` del fichero resuelto; no se permite guardar con bloques sin resolver.
- Al quedarse sin conflictos, aviso para continuar la operación desde el banner (OG-019).
- Ficheros binarios o no UTF-8: aviso y resolución fuera de la app.

## Criterios de aceptación

- [x] Un merge en conflicto lista sus ficheros y muestra los bloques con ours/theirs. _(tests de parser, store y UI)_
- [x] Elegir un lado por bloque construye el contenido resuelto exacto (incluido el newline final). _(tests de `resolvedContent`)_
- [x] Guardar hace stage del fichero y desaparece de conflictos. _(test de Rust con merge real)_
- [x] Con bloques sin resolver, guardar se rechaza con un mensaje claro. _(test + botón deshabilitado)_
- [x] Al resolver el último fichero se avisa de que se puede continuar. _(mensaje en Salida)_

## Fuera de alcance

- Edición libre del contenido (solo elección por bloque).
- Resolución de borrado/modificación sin marcadores (se avisa y se resuelve fuera).
- Conflictos binarios.

## Notas técnicas

- Se lee el fichero de trabajo tal cual (ya contiene los marcadores) en lugar de recomponer desde los stages `:1:/:2:/:3:`; más simple y respeta `merge.conflictStyle` del usuario.
- El parseo y la construcción del resultado son funciones puras con tests.
- La ruta se valida (relativa, sin `..`) antes de leer o escribir.

## Notas de implementación (2026-09-18)

- Rust: `read_worktree_file` y `write_and_stage` en `repo/ops.rs`; comandos `read_conflict_file` y `resolve_conflict`.
- Frontend: `lib/conflict/parse.ts` (bloques + reconstrucción), `stores/conflict.ts` y `ConflictView` con acciones por bloque; se entra desde la sección Conflicts de File status.
- De paso, el panel de commit ya no lista los ficheros en conflicto como staged (bug detectado por los tests).
- Pendiente para cerrar: PR y CI verde.
