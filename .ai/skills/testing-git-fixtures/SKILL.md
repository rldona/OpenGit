---
name: testing-git-fixtures
description: Use when writing tests for git parsers or git-dependent behavior (fixtures, temp repos, tempdir, deterministic commits, CRLF, non-ASCII paths, binary files). Triggers on fixture, test repo, git init, tmpdir, integration test, parser test, CI matrix. Covers isolation from user config, deterministic dates and offline rules.
---

# Tests de git: fixtures y repos temporales

## Dos niveles

1. **Parsers (unit):** fixtures como strings en el repo (`tests/fixtures/*.txt`) cargadas con `include_str!`. Sin disco, sin red, sin git.
2. **Integración:** repos temporales creados por el test con `git init`. Sin red, sin el repo del proyecto (regla 8 de AGENTS.md).

## Aislamiento obligatorio del entorno

Un test no puede depender de la config del desarrollador ni de la máquina:

```rust
// Rust: helper de test
cmd.env("GIT_CONFIG_GLOBAL", &empty_config)   // fichero vacío dentro del tempdir
   .env("GIT_CONFIG_NOSYSTEM", "1")
   .env("GIT_TERMINAL_PROMPT", "0")
   .env("TZ", "UTC")
   .env_remove("GIT_DIR")
   .env_remove("GIT_WORK_TREE");
```

- En los `git commit` del test: `-c user.name=Test -c user.email=test@example.com -c commit.gpgsign=false -c core.autocrlf=false`.
- Fechas fijas: `GIT_AUTHOR_DATE` y `GIT_COMMITTER_DATE` (formato `@1700000000 +0000`) para timestamps reproducibles.
- No usar `/dev/null` como config global: en Windows no existe; usa un fichero vacío en el tempdir.

## Matriz de casos (obligatoria al tocar parsers)

| Caso | Cómo provocarlo |
| --- | --- |
| Repo vacío | `git init` sin commits |
| Detached HEAD | `git checkout <hash>` |
| Rename | `git mv` + commit con `-M` |
| Binario | bytes nulos en el fichero |
| CRLF | escribir el fichero con `\r\n` y sin `core.autocrlf` |
| Sin newline final | `printf 'x' > f` (sin `\n`) |
| Non-ASCII | ruta `carpeta/ñandú-日本.txt` |
| Merge / conflicto | dos ramas sobre la misma línea |
| Submódulo (lectura) | `git submodule add` de un repo local |

## Reglas de ejecución

- Limpia al terminar: en Windows, un proceso git vivo mantiene locks en `.git`; cierra antes de borrar el tempdir.
- Nada de `sleep` para "esperar" al watcher: expón una señal o inyecta un notificador falso.
- Los tests de rendimiento usan un repo sintético de 10 000 commits generado con `git fast-import` o `commit-tree` en bucle; no entran en la suite rápida.

## Anti-patrones

- Heredar la config global del usuario (`gpgsign`, hooks, `init.defaultBranch` cambia el nombre de la rama).
- Crear repos de prueba dentro del repo del proyecto.
- Fixtures "inventadas" a mano en vez de salida real de git de la versión soportada (2.34+).
- Tests que dependen del orden de ejecución o comparten un tempdir.
