# OG-006 · Stage/unstage por hunks y líneas

- **Milestone:** M1 — MVP local
- **Estado:** backlog
- **Depende de:** OG-005
- **Referencias:** skill `hunk-staging`, ADR-0003

## Contexto

Es la funcionalidad que más se usa en el día a día y la razón principal para no abrir el terminal: preparar commits parciales.

## Alcance

- Seleccionar hunks, líneas individuales o rangos y pasarlos al index.
- Unstage equivalente desde el diff staged.
- Stage/unstage de fichero completo.
- La UI de diff refleja el estado resultante sin recargar toda la vista.
- Manejo correcto de: CRLF, fichero sin newline final, EOF marker, ficheros nuevos y borrados, renombrados.

## Criterios de aceptación

- [ ] Stagear un hunk actualiza el index (verificado con `git diff --cached`) sin tocar el working tree.
- [ ] Stagear líneas sueltas dentro de un hunk produce el parche correcto, incluidos los bordes.
- [ ] Unstage devuelve el contenido exacto al working tree.
- [ ] CRLF y ausencia de newline final no corrompen el fichero tras el stage.
- [ ] Nombres de fichero con espacios, comillas o UTF-8 funcionan.

## Fuera de alcance

- Edición del contenido durante el stage.
- Stage interactivo histórico (`git add -p` guiado por consola).

## Notas técnicas

- Implementación por parches: reconstruir el hunk seleccionado, `git apply --cached -` (stdin) para stage y `git apply --cached --reverse -` para unstage. El parche se pasa por stdin, nunca por archivo temporal en el repo.
- Normalizar cabeceras del hunk (`@@ -a,b +c,d @@`) al recortar líneas; un offset mal calculado corrompe el parche.
- Test de integración obligatorio: repo temporal, stage parcial, verificar con `git diff --cached --numstat` y con el contenido leído de disco.
- La representación interna del hunk debe conservar el byte exacto de cada línea para no alterar el fichero.
