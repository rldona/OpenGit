# OG-003 · Adaptador git en Rust: runner y parsers

- **Milestone:** M1 — MVP local
- **Estado:** backlog
- **Depende de:** OG-001
- **Referencias:** ADR-0003, skill `git-cli-parsing`

## Contexto

Todo el resto de la app depende de una capa única y segura para ejecutar git y convertir su salida en modelos tipados. Es la pieza más crítica de M1.

## Alcance

- Runner de procesos: `argv` sin shell, directorio de trabajo, entorno controlado (`GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`, `GIT_OPTIONAL_LOCKS=0` en lecturas), timeout y cancelación (kill del proceso y de sus hijos).
- Captura separada de `stdout`/`stderr`, exit codes interpretados y error tipado (`GitError`) con mensaje para UI.
- Parsers iniciales, todos con `-z` o `--format` con separadores NUL:
  - log paginado (`--topo-order --parents`);
  - status (`--porcelain=v2 -z --branch`);
  - refs (`for-each-ref --format ... -z`);
  - diff/numstat (`-z`), con detección de binarios y renombrados.
- Modelos compartidos con el frontend: `Commit`, `FileStatus`, `Ref`, `FileDiff`.
- Detección de versión de git y mínimo 2.34.

## Criterios de aceptación

- [ ] Ejecutar git con argumentos que contengan espacios, comillas y UTF-8 funciona sin shell.
- [ ] Un comando cancelado no deja procesos huérfanos.
- [ ] Cada parser tiene unit tests con fixtures de salida real, incluidos: repo vacío, detached HEAD, rename, binario, CRLF, sin newline final y non-ASCII.
- [ ] Ningún parser interpreta mensajes localizados ni salida por defecto de git.
- [ ] Errores de git (exit code ≠ 0) llegan a la UI con stderr y código.

## Fuera de alcance

- Operaciones de escritura (commit, checkout, stage) — van en sus tickets.
- `gix` o cualquier lectura alternativa (ADR-0003 lo deja para más adelante).

## Notas técnicas

- Los fixtures son strings en Rust (`include_str!` o constantes) generados con la versión de git soportada; sin tocar disco ni red (regla 8 de AGENTS.md).
- Para tests de integración, repos temporales con `git init` en `tempdir`, creados y destruidos por el test.
- El runner debe exponer un trait para poder mockearlo en tests de comandos que no necesiten git real.
