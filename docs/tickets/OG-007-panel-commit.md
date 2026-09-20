# OG-007 · Panel de commit

- **Milestone:** M1 — MVP local
- **Estado:** in-progress
- **Depende de:** OG-006, OG-009
- **Referencias:** ADR-0003

## Contexto

Cerrar el ciclo básico: stage, mensaje y commit, con la información necesaria para confiar en lo que se va a commitear.

## Alcance

- Área de mensaje con contador de caracteres y validación de "no vacío".
- Lista de cambios staged antes de commitear.
- Amend del último commit con aviso explícito de reescritura.
- Stage y commit de ficheros no trackeados desde el panel.
- Salida de hooks (`pre-commit`, `commit-msg`) visible cuando fallan.
- Detección de merge/rebase en curso: ofrecer continuar o abortar (M4 completa la experiencia, aquí solo el aviso).

## Criterios de aceptación

- [x] Commit normal con hooks correctos y con hook que falla (error legible con la salida del hook). _(`command_failed` incluye stdout y stderr; test con hook que falla)_
- [x] Amend actualiza el mensaje y el contenido staged del último commit. _(test: el contador de commits no cambia y el árbol del commit se actualiza)_
- [x] Sin cambios staged, el commit se rechaza con un mensaje claro. _(validación en el store, con test)_
- [x] Mensajes con UTF-8, multilínea y comillas llegan intactos al commit. _(mensaje por stdin con `--file=-`; test comparando `%B` byte a byte)_
- [x] Tras commitear, grafo, status y diff se reflejan solos (evento del watcher OG-010). _(además del watcher, el store refresca status y recarga el log al terminar)_

## Fuera de alcance

- Firma GPG/SSH (se hará si algún día hace falta).
- Plantillas de mensaje, co-autores y trailers de equipo (posible M3).

## Notas técnicas

- El mensaje se pasa por stdin o `-F -`, nunca interpolado en `-m` dentro de un shell; con `-m` hay que escapar, con stdin no.
- `git commit` sin `--no-verify`: los hooks del usuario mandan.
- Para amend, confirmación en UI la primera vez (regla 1 de AGENTS.md no aplica porque no es destructivo irreversible, pero sí reescribe historia local).

## Notas de implementación (2026-09-18)

- Rust: `git::commit` (mensaje por stdin con `--file=-`, `--amend` opcional, sin `--no-verify`), `git::last_commit_message` (precarga del amend) y `git::repo_op_state` (MERGE_HEAD, rebase-merge/-apply, CHERRY_PICK_HEAD/REVERT_HEAD). Comandos `commit_message`, `commit_repo` y `repo_op_state`.
- `GitError::CommandFailed` ahora lleva también `stdout`: los hooks escriben ahí su salida y antes se perdía. El frontend muestra stderr y cae a stdout si está vacío.
- UI: `CommitPanel` al pie de File status, con lista compacta de lo staged, checkbox de amend (con confirmación nativa y mensaje precargado), textarea con contador, validaciones y aviso de merge/rebase/cherry-pick en curso (deshabilita el botón; las acciones de continuar/abortar llegan en M4).
- El stage de untracked ya se cubre desde File status (OG-009); el panel refleja el index en vivo.
- Tests: 5 de Rust (UTF-8 multilínea, sin staged, amend, hook que falla, merge en curso) y 10 de frontend (store + panel).
- Pendiente para cerrar: PR y CI verde.
