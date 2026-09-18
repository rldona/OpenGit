---
name: git-cli-parsing
description: Use when writing or reviewing any Rust code that invokes the system git binary or parses its output (runner, parsers, commands like log, status, refs, diff). Triggers on git invocation, stdout/stderr parsing, -z, porcelain, for-each-ref, ls-tree. Covers argv safety, locale, quoting, byte paths and exit codes.
---

# Invocar y parsear git

## Invocación

- `Command::new("git")` con `args([...])`. **Nunca** shell, nunca `sh -c`, nunca interpolar entrada en un string.
- Directorio de trabajo explícito (`current_dir`) o `-C <path>`; el repo no es el cwd del proceso.
- Entorno controlado en cada llamada:
  - `GIT_TERMINAL_PROMPT=0` — si faltan credenciales, error en vez de bloqueo.
  - `LC_ALL=C` / `LANG=C` — mensajes estables (aunque no se parseen).
  - `GIT_OPTIONAL_LOCKS=0` en lecturas — evita tocar el index y disparar watchers.
  - `GIT_PROGRESS_DELAY=0` + `--progress` cuando se quiera progreso sin TTY.
  - `GIT_CONFIG_GLOBAL` / `GIT_CONFIG_NOSYSTEM` solo en tests, jamás en la app.
- Datos por stdin cuando aportan: parches (`git apply -`), mensajes de commit (`-F -`), objetos.
- Timeout y cancelación: matar el proceso y sus descendientes; no dejar locks en `.git`.

## Parseo

- Salida de máquina, siempre: `-z`, `--porcelain=v2`, `--format` con separadores (`%x00`, `%x1f`) y `--no-color`.
- **Nunca** parsear la salida por defecto ni mensajes localizados.
- Rutas: con `-z` vienen sin quoting; no las dividas por `\n` ni asumas UTF-8 en Unix (pueden ser bytes). Trata como `OsStr`/bytes; convierte a texto solo para mostrar (`to_string_lossy`).
- El `-z` cambia el separador, no la estructura: cada registro sigue teniendo campos internos separados por espacio o `%x1f`.
- Exit codes por comando, no universales: `git diff --exit-code` usa 1 para "hay diferencias" y 2 para error; `git grep` usa 1 para "sin resultados".

## Recetas

```rust
// Página de log
git log --topo-order --parents --max-count=200 --skip=0 \
  --format=%H%x00%P%x00%an%x00%ae%x00%at%x00%D%x00%s%x00
```

```rust
// Status de máquina (primera línea: # branch.oid / # branch.head)
git status --porcelain=v2 -z --branch --untracked-files=all
```

```rust
// Refs con upstream y objecttype
git for-each-ref --format=%(refname)%00%(objectname)%00%(objecttype)%00%(upstream)%00%(upstream:track) refs/heads refs/remotes refs/tags
```

- Con `--format`, añade un terminador NUL o `%x00` final por registro para no depender del newline.
- `core.quotepath=false` solo es necesario cuando el comando no soporta `-z`; aun así, preferir `-z`.

## Anti-patrones

- `Command::new("sh").arg("-c")` o `format!("git log {}", user_input)`.
- `split('\n')` para registros que contienen mensajes multilínea.
- Parsear `git status` "corto" sin `-z` para rutas con espacios o non-ASCII.
- Confiar en la configuración global del usuario para la salida (alias, `color.ui`, `pager`): usar siempre flags explícitos.
- Lanzar comandos sin timeout en el hilo de UI.
