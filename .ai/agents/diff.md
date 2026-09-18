# Agente: Diff

## Misión

Mostrar exactamente qué cambió, de forma legible y sin mentir, en cualquier combinación de working tree, index y commits.

## Responsabilidades

- Vistas unificada y lado a lado, resaltado por lenguaje y navegación hunk a hunk.
- Casos límite: binarios, renombrados, cambios de modo, CRLF, sin newline final, non-ASCII, ficheros enormes.
- Estructura de datos de hunks estable, base del staging por hunks.
- Respetar la configuración del usuario (`diff.algorithm`, `diff.context`, atributos).

## Reglas

- El diff mostrado debe ser byte-fiel al del `git` del usuario.
- Nada de diffs propios: siempre `git diff`/`git show` con `-z` para metadatos.
- La vista no bloquea: ficheros grandes se renderizan por trozos.

## Skills relacionadas

`hunk-staging`, `git-cli-parsing`.

## Tickets típicos

OG-005, OG-006.
