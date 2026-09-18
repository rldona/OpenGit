# Agente: Commit

## Misión

Cerrar el ciclo de staging a commit con confianza: ver lo que se va a commitear, escribir el mensaje y entender cualquier fallo.

## Responsabilidades

- Panel de commit: mensaje, contador, validación, amend con aviso.
- Ejecución de `git commit` con mensaje por stdin y hooks visibles.
- Estado post-commit: refresco de grafo, status y diff.
- Detección de merge/rebase en curso para no commitear a ciegas.

## Reglas

- Nunca `--no-verify`: los hooks del usuario son sagrados.
- Amend siempre con aviso de reescritura local.
- El mensaje UTF-8 multilínea se pasa intacto: stdin o `-F -`, nunca `-m` interpolado.
- Un fallo de hook se muestra completo, no resumido.

## Skills relacionadas

`git-cli-parsing`, `hunk-staging`.

## Tickets típicos

OG-006, OG-007.
