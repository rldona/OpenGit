# OG-021 · Rebase interactivo visual

- **Milestone:** M4 — Rebase y conflictos
- **Estado:** done
- **Depende de:** OG-004, OG-019, OG-020
- **Referencias:** ROADMAP.md

## Contexto

Última pieza de M4: reescribir una serie de commits (reordenar, unir, descartar, renombrar) con un plan visible antes de ejecutar y sin pasar por el editor de git.

## Alcance (v1)

- Acción **Interactive rebase from here** sobre un commit del grafo: el plan son los commits desde HEAD hasta ese punto (excluido), en orden.
- Acciones por commit: **pick**, **reword**, **squash**, **fixup** y **drop**.
- Reordenar con subir/bajar.
- **Reword simple**: un único mensaje para todo el plan (solo se permite un `reword`); el mensaje se aplica con `exec git commit --amend -F`.
- Vista previa del plan y confirmación antes de ejecutar (reescribe historia).
- Si hay conflictos, el rebase queda en curso y aplican el banner (OG-019) y el editor (OG-020).
- Abort disponible en todo momento.

## Criterios de aceptación

- [x] El plan lista los commits correctos (base excluida) y permite reordenar y elegir acción. _(tests)_
- [x] Squash/fixup unen commits y conservan el contenido final. _(test: el squash conserva el asunto del commit anterior y añade el mensaje del siguiente al cuerpo)_
- [x] Drop elimina los cambios del commit descartado. _(test)_
- [x] Reword cambia el mensaje del commit marcado (un mensaje por plan). _(test)_
- [x] Un conflicto deja el rebase en curso y se puede abortar. _(test)_
- [x] Confirmación antes de ejecutar y refresco de grafo/refs/status al terminar. _(test de UI y store)_

## Fuera de alcance

- Un mensaje distinto por cada reword (v2).
- `edit` (parar en un commit), autosquash y ejecución de comandos arbitrarios.
- Rebase sobre ramas publicadas más allá del aviso.

## Notas técnicas

- El todo-list se inyecta con `GIT_SEQUENCE_EDITOR="cp '<todo>'"`; el fichero (y el mensaje del reword) viven en el directorio de datos de la app, nunca en el repo.
- Reword no usa la acción `reword` (que abre editor) sino `exec git commit --amend -F <mensaje>` para no interferir con los mensajes por defecto de squash.
- El plan se obtiene con `git log --reverse --format=%H%x1f%s <base>..HEAD`.
- Los hashes se validan (hex) antes de usarlos.

## Notas de implementación (2026-09-18)

- Rust: `rebase_plan` e `interactive_rebase` (todo-list en el directorio de datos, un solo reword validado, timeout amplio); comandos `rebase_plan` e `interactive_rebase`.
- UI: `RebaseView` con el plan (acción por fila, subir/bajar, mensaje si hay reword) y confirmación; se entra desde el detalle del commit en el grafo.
- Tests: Rust (plan, squash+fixup, drop, reword, reordenar, conflicto y abort) y frontend (store y vista).
- Con esto queda completo M4 (reword múltiple queda para una v2). Cerrado el 2026-09-18 con CI verde (Frontend 32 s, Rust 1m38s) en el PR #17.
