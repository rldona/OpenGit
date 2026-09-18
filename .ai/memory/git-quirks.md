# Git — peculiaridades

## El progreso de fetch/push no sale sin TTY

- **Fecha:** 2026-09-18
- **Contexto:** diseñar el panel de salida en streaming para M2.
- **Hallazgo:** git desactiva el progreso cuando stderr no es una terminal. Con `GIT_PROGRESS_DELAY=0` y `--progress` se fuerza igualmente.
- **Implicación:** lanzar las operaciones de red con esas variables/flags y parsear el progreso como best-effort; la verdad es el exit code.

## `GIT_OPTIONAL_LOCKS=0` en lecturas

- **Fecha:** 2026-09-18
- **Contexto:** evitar que el watcher de `.git` reaccione a nuestras propias lecturas.
- **Hallazgo:** `git status` puede refrescar el index y tocar `.git/index` aunque no cambies nada.
- **Implicación:** exportar `GIT_OPTIONAL_LOCKS=0` en comandos de lectura; el watcher se pausa además durante operaciones propias (OG-010).

## Rutas no-UTF8 en Unix

- **Fecha:** 2026-09-18
- **Contexto:** modelar nombres de fichero entre Rust y JSON.
- **Hallazgo:** en Unix un path puede ser bytes inválidos como UTF-8; `-z` los entrega tal cual, sin quoting.
- **Implicación:** no hacer `unwrap()` de `to_str()` en paths; conservar `OsString`/bytes y usar `to_string_lossy` solo para mostrar.

## `core.quotepath=false` solo cuando no hay `-z`

- **Fecha:** 2026-09-18
- **Contexto:** nombres con acentos salían escapados (`\303\261`) en algunas consultas.
- **Hallazgo:** git cita los paths non-ASCII en salida no-`-z`; con `-z` no aplica.
- **Implicación:** preferir siempre `-z`; si un comando no lo soporta, añadir `-c core.quotepath=false`.

## Mensajes de commit con `-m` y shell

- **Fecha:** 2026-09-18
- **Contexto:** commitear desde la app.
- **Hallazgo:** interpolar el mensaje en `-m` requiere escapar comillas y rompe saltos de línea.
- **Implicación:** pasar el mensaje por stdin (`-F -`), nunca concatenado.

## Formatos exactos con `-z` (log, status, numstat)

- **Fecha:** 2026-09-18
- **Contexto:** parsers de OG-003; los detalles no obvios se verificaron con fixtures reales.
- **Hallazgo:**
  - `git log -z --format=...`: `-z` separa los commits con NUL (además de los separadores del formato); con `%x1f` entre campos queda un stream de tokens limpio.
  - Rename en `status --porcelain=v2 -z`: la ruta nueva cierra el registro y la original es el **siguiente token** NUL, no un campo del mismo token.
  - Rename en `diff --numstat -z`: el token de contadores lleva la ruta vacía (`1\t0\t`) y las dos rutas van en los dos tokens siguientes.
- **Implicación:** parsear por tokens secuenciales con índice, no pre-dividir registros asumiendo un NUL por entrada. Los fixtures reales están en `src-tauri/tests/fixtures/` y se regeneran con `generate.sh`.
