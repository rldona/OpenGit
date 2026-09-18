# OG-015 · Gestión de tags

- **Milestone:** M3 — Historial avanzado
- **Estado:** in-progress
- **Depende de:** OG-008, OG-011
- **Referencias:** docs/architecture/overview.md

## Contexto

El sidebar ya lista tags (anotados y ligeros) pero no permite crearlos, borrarlos ni subirlos al remoto.

## Alcance

- Crear tag ligero o anotado (con mensaje) sobre el commit seleccionado o HEAD.
- Borrar tag local con confirmación.
- Push del tag al remoto reutilizando el sistema de jobs (streaming y cancelación).
- Mantener la distinción visual anotado/ligero.

## Criterios de aceptación

- [x] Crear un tag ligero y uno anotado y verlos en el sidebar con su tipo correcto. _(tests de Rust y UI)_
- [x] El tag anotado guarda el mensaje. _(test con `git tag -n -l`)_
- [x] Borrar un tag pide confirmación y desaparece del sidebar. _(confirmación nativa + test)_
- [x] Push del tag al remoto se ve en streaming y deja el tag en el remoto. _(JobKind::PushTag + test con bare local)_
- [x] Nombres inválidos se rechazan con error legible (`git check-ref-format`). _(test)_

## Fuera de alcance

- Editar o mover tags existentes.
- Firma de tags.

## Notas técnicas

- Crear: `git tag <name> <target>` / `git tag -a <name> -m <msg> <target>`; borrar: `git tag -d <name>`.
- Push: nuevo `JobKind::PushTag` → `git push --progress <remote> refs/tags/<name>` (por defecto `origin`).
- El nombre se valida con `git check-ref-format` antes de tocar nada.

## Notas de implementación (2026-09-18)

- Rust: `tag_create` y `tag_delete` en `git/mod.rs`; `JobKind::PushTag` reutiliza el streaming de OG-011.
- UI: en el sidebar de Tags, botón "+" (nombre, mensaje opcional y checkbox anotado; destino = commit seleccionado o HEAD) y acciones Delete/Push por tag con confirmación en el borrado.
- Tests: Rust (crear ligero/anotado, borrar, nombre inválido, push a bare local) y frontend (store y sidebar).
- Pendiente para cerrar: PR y CI verde (comparte PR con OG-016).
