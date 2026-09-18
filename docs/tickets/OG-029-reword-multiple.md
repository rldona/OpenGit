# OG-029 · Reword múltiple en rebase interactivo (v2)

- **Milestone:** M5 — Pulido (v2 de OG-021)
- **Estado:** done
- **Depende de:** OG-021
- **Referencias:** ROADMAP.md, docs/tickets/OG-021-rebase-interactivo.md

## Contexto

OG-021 permitió un solo `reword` por plan con un único mensaje global, resuelto con `pick` + `exec git commit --amend -F`. Era una limitación explícita de la v1; ahora se levanta.

## Alcance

- `TodoItem` gana un `message` opcional; cada `reword` lleva su propio mensaje y `interactive_rebase` deja de aceptar el mensaje global.
- Un fichero de mensaje por reword (`rebase-message-<índice>.txt` en el directorio de datos) y un `exec git commit --amend -F` tras el pick correspondiente.
- Sin límite de rewords; sigue sin permitirse `reword` sin mensaje.
- Store: el mensaje vive en la fila y viaja con ella al reordenar; `run` valida que todos los rewords tengan texto.
- UI: input de mensaje en cada fila marcada como `reword`; el botón Run se deshabilita si falta alguno.
- Tests: dos rewords con mensajes distintos, reword sin mensaje, reordenar conservando el mensaje y validación en store/UI.

## Criterios de aceptación

- [x] Dos `reword` en el mismo plan aplican dos mensajes distintos.
- [x] Un `reword` sin mensaje falla con un error claro y ningún reword con mensaje vacío llega a git.
- [x] Reordenar una fila mueve su acción **y** su mensaje.
- [x] La UI muestra un input por fila `reword` y bloquea Run hasta completarlos.
- [x] Tests Rust (integración) y frontend (store y vista) actualizados.

## Fuera de alcance

- Editar el cuerpo del mensaje con un editor completo o multilínea con formato.
- `edit`, `autosquash` y comandos arbitrarios (siguen fuera, como en OG-021).
- Mantener los ficheros de mensaje entre ejecuciones: son temporales del run.

## Notas técnicas

- El todo-list sigue inyectándose con `GIT_SEQUENCE_EDITOR`; los ficheros de mensaje se numeran por posición en el plan y se sobrescriben en cada ejecución.
- `message` se recorta (trim) al escribir el fichero; los `message` en acciones distintas de `reword` se ignoran.
- En la UI, el mensaje no se indexa por hash sino que viaja dentro de la fila: reordenar ya intercambia filas completas.

## Notas de implementación (2026-09-18)

- Rust: `TodoItem.message` con `#[serde(default)]`; `interactive_rebase` pierde el `reword_message` global y escribe `rebase-message-<índice>.txt` por cada reword, con un `exec` tras su pick. La validación es por item.
- Frontend: `PlanRow.message`; el store pasa `message` solo en rewords (`null` en el resto); `RebaseView` pinta el input dentro de la fila (con `flex-wrap`) y deshabilita Run si falta alguno.
- Tests: 110 Rust (rewords múltiples y reword sin mensaje separados) y 180 frontend (varios mensajes, viaje al reordenar y validación por fila).
- Cerrado el 2026-09-18 con CI verde (Frontend 37 s, Rust 1m14s) en el PR #26.
