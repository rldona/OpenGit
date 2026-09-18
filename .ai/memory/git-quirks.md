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

## La salida de git no se normaliza si no hay streaming

- **Fecha:** 2026-09-18
- **Contexto:** OG-011 añadió un lector por líneas para el progreso de fetch/pull/push (que usa `\r`).
- **Hallazgo:** al trocear también por `\r` en los comandos normales, los parches CRLF perdían el `\r` y `git apply` fallaba (`patch does not apply`). Regresión detectada por los tests de OG-006.
- **Implicación:** `read_stream` solo normaliza cuando hay sink; sin él, `read_to_end` byte a byte. Cualquier cambio en el runner debe pasar la suite de staging con CRLF.

## El tracking exige un remoto configurado, no solo la ref

- **Fecha:** 2026-09-18
- **Contexto:** tests de OG-008 con `refs/remotes/origin/x` creadas con `update-ref`.
- **Hallazgo:** `git branch --set-upstream-to=origin/x` y `git checkout --track origin/x` fallan con `starting point is not a branch` si no existe un remoto `origin` en la config, aunque la ref remota exista.
- **Implicación:** en tests, añadir `git remote add origin <ruta-inexistente>` antes (sin red). En la app no aplica porque los remotos vienen del repo del usuario.

## La salida de los hooks de commit va a stdout

- **Fecha:** 2026-09-18
- **Contexto:** OG-007; al fallar un `pre-commit` solo se veía el stderr de git.
- **Hallazgo:** los hooks escriben sus mensajes en **stdout**; `GitError::CommandFailed` solo guardaba stderr y se perdía la causa real.
- **Implicación:** `CommandFailed` incluye `stdout` y `stderr`; al mostrar errores, preferir stderr y caer a stdout. El mensaje del commit se pasa por stdin (`--file=-`), sin `--no-verify`.

## Stage parcial: un `-` descartado debe pasar a contexto

- **Fecha:** 2026-09-18
- **Contexto:** reconstrucción de parches por líneas en OG-006.
- **Hallazgo:** si se deselecciona la línea `-vieja` de un par `-vieja/+nueva`, el index sigue teniendo `vieja`; emitir el parche sin ella rompe el contexto posterior (`error: patch does not apply`). Hay que emitirla como contexto (` vieja`). Los `+` descartados se omiten sin más, y los marcadores `\ No newline at end of file` solo valen si su línea sigue en el parche.
- **Hallazgo 2:** git fusiona en un solo hunk los cambios separados por menos de 2×contexto (por defecto 3 líneas); al escribir tests de hunks hay que separarlos más de 6 líneas.
- **Implicación:** implementado y cubierto en `git::patch::ParsedPatch::build`; cualquier cambio ahí exige pasar los tests de CRLF y sin newline final.

## Formatos exactos con `-z` (log, status, numstat)

- **Fecha:** 2026-09-18
- **Contexto:** parsers de OG-003; los detalles no obvios se verificaron con fixtures reales.
- **Hallazgo:**
  - `git log -z --format=...`: `-z` separa los commits con NUL (además de los separadores del formato); con `%x1f` entre campos queda un stream de tokens limpio.
  - Rename en `status --porcelain=v2 -z`: la ruta nueva cierra el registro y la original es el **siguiente token** NUL, no un campo del mismo token.
  - Rename en `diff --numstat -z`: el token de contadores lleva la ruta vacía (`1\t0\t`) y las dos rutas van en los dos tokens siguientes.
- **Implicación:** parsear por tokens secuenciales con índice, no pre-dividir registros asumiendo un NUL por entrada. Los fixtures reales están en `src-tauri/tests/fixtures/` y se regeneran con `generate.sh`.

## Rebase interactivo sin editor: GIT_SEQUENCE_EDITOR y reword con `exec`

- **Fecha:** 2026-09-18
- **Contexto:** OG-021; hay que ejecutar `git rebase -i` con un plan generado por la app, sin abrir editores.
- **Hallazgo:**
  - `GIT_SEQUENCE_EDITOR="cp '<todo>'"` funciona: git invoca `<editor> <fichero-todo>`, así que `cp` recibe origen y destino. El todo vive en el directorio de datos de la app, nunca en el repo.
  - La acción `reword` abre el editor de mensajes, que choca con el `GIT_EDITOR=true` que usamos para aceptar los mensajes por defecto del squash. Se resuelve emitiendo `pick <sha>` + `exec git commit --amend -F '<mensaje>'`; así cada reword (en v1, uno) tiene su mensaje sin editor.
  - En un squash, el asunto resultante es el del commit **anterior** (el que recibe), no el del squashado: `pick c1; squash c2` deja el asunto de c1 y el mensaje de c2 en el cuerpo.
- **Implicación:** el todo-list es un detalle interno de `interactive_rebase`; cualquier cambio debe cubrir squash/fixup, drop, reword, reordenar y conflicto con abort.
