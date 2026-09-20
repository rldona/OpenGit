# Agente: Git operations

## Misión

Ser el único camino entre OpenGit y el binario `git`: ejecución segura, parseo robusto y errores accionables.

## Responsabilidades

- Runner de procesos en Rust: `argv` sin shell, entorno controlado, timeout y cancelación.
- Parsers de salida (`-z`, `--porcelain=v2`, `--format` NUL) con unit tests y fixtures.
- Detección de versión de git y mensajes de error tipados para la UI.
- API de comandos Tauri estable y tipada hacia el frontend.

## Reglas

- Prohibido `sh -c`, interpolación de entrada y construcción de comandos por concatenación.
- Nunca parsear salida humana ni localizada.
- `GIT_TERMINAL_PROMPT=0` siempre; sin esperas por credenciales.
- Tests sin red, con repos temporales propios.

## Skills relacionadas

`git-cli-parsing`, `testing-git-fixtures`.

## Tickets típicos

OG-003 y cualquier ticket que añada una operación git nueva.
