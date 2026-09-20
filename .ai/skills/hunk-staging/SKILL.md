---
name: hunk-staging
description: Use when implementing or fixing stage/unstage of hunks, lines or selections (git apply --cached, patch reconstruction, partial staging). Triggers on hunk, patch, index, staged, CRLF, no newline at end of file, EOF marker. Covers patch construction, --recount, reverse apply and verification.
---

# Stage por hunks con parches

## Estrategia

El index se modifica con un parche aplicado sobre `--cached`. Nunca se reescribe el índice a mano ni se toca el working tree.

```bash
git diff -U3 --no-color --no-ext-diff -- <path>        # working tree vs index
git diff --cached -U3 --no-color -- <path>             # index vs HEAD (para unstage)
git apply --cached --recount -                         # stage (parche por stdin)
git apply --cached --reverse --recount -               # unstage
```

- `--recount` recalcula los contadores de los hunks: úsalo siempre que reconstruyas parches.
- El parche va por **stdin**, no por fichero temporal en el repo (evita basura y watchers falsos).
- `--whitespace=nowarn` para no sorprender al usuario con avisos de whitespace.

## Construcción del parche

1. Parte del diff original del fichero y localiza el hunk y las líneas seleccionadas.
2. Conserva las líneas de contexto necesarias (`@@ -a,b +c,d @@`); si recortas contexto, recalcula cabeceras con `--recount` o a mano.
3. Mantén **el byte exacto** de cada línea: prefijos ` `, `+`, `-` y el marcador `\ No newline at end of file` en su sitio.
4. Reconstruye el bloque `diff --git a/... b/...` con `--- a/...` y `+++ b/...`, rutas sin comillas raras y sin prefijos duplicados.
5. Para líneas sueltas dentro de un hunk, el parche resultante puede partir el hunk; verifica con `git apply --check` antes de aplicar.

## Verificación (en tests)

```bash
git diff --cached --numstat        # qué quedó staged
git diff --numstat                 # qué quedó sin staged
git ls-files -s -- <path>          # hash del blob en el index
```

- Después de un unstage, el working tree debe quedar idéntico: compara `git hash-object <path>` con el blob esperado.

## Casos que rompen parches

- **CRLF:** el diff puede traer `\r`; aplica tal cual y no re-normalices (respeta `core.autocrlf` del usuario).
- **Sin newline final:** el marcador `\ No newline at end of file` debe ir pegado a la línea afectada; sin él, git añade un newline y corrompe el fichero.
- **Fichero nuevo/borrado:** usa `/dev/null` en el lado correspondiente y `new file mode`/`deleted file mode`.
- **Rutas con espacios o non-ASCII:** el formato `diff --git` las cita; con `--no-prefix` y comillas se complica. Prefiere `--no-color --no-ext-diff` y rutas tal cual las da `git diff -z` para la capa de datos.
- **Modo de fichero:** un cambio de permisos no es un hunk; va en la cabecera `old mode/new mode`.

## Anti-patrones

- Escribir el parche en un fichero dentro del repo y llamar a `git apply <archivo>`.
- Construir el parche con strings sin conservar los bytes originales (pierdes CRLF o el marcador EOF).
- Aplicar sin `--cached` (ensucia el working tree) o sin `--reverse` al hacer unstage.
- Confiar en el número de líneas original sin `--recount`.
