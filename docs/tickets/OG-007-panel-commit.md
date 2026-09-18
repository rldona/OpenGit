# OG-007 · Panel de commit

- **Milestone:** M1 — MVP local
- **Estado:** backlog
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

- [ ] Commit normal con hooks correctos y con hook que falla (error legible con la salida del hook).
- [ ] Amend actualiza el mensaje y el contenido staged del último commit.
- [ ] Sin cambios staged, el commit se rechaza con un mensaje claro.
- [ ] Mensajes con UTF-8, multilínea y comillas llegan intactos al commit.
- [ ] Tras commitear, grafo, status y diff se refrescan solos (evento del watcher OG-010).

## Fuera de alcance

- Firma GPG/SSH (se hará si algún día hace falta).
- Plantillas de mensaje, co-autores y trailers de equipo (posible M3).

## Notas técnicas

- El mensaje se pasa por stdin o `-F -`, nunca interpolado en `-m` dentro de un shell; con `-m` hay que escapar, con stdin no.
- `git commit` sin `--no-verify`: los hooks del usuario mandan.
- Para amend, confirmación en UI la primera vez (regla 1 de AGENTS.md no aplica porque no es destructivo irreversible, pero sí reescribe historia local).
