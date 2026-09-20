# OG-056 · Gestión de remotos

- **Milestone:** M8 — Paridad SourceTree (fase 3)
- **Estado:** ready
- **Depende de:** OG-011, OG-041
- **Referencias:** ROADMAP.md, OG-034

## Contexto

La sidebar lista remotos y sus ramas, y el menú de Branches ya enseña
`New Remote…` **deshabilitado** porque no hay backend. Añadir o corregir un
remoto obliga a salir al terminal: es el hueco más visible de la UI.

## Alcance

- Comandos Rust: `remote_add`, `remote_set_url`, `remote_rename` y
  `remote_remove` (argv, sin shell; nombre validado).
- Diálogo "New Remote…" (nombre + URL) desde el menú contextual de Branches y
  desde el de Remotes; URL mostrada bajo el nombre como ya hace el diálogo de
  Pull.
- Menú contextual de cada remoto: Edit URL, Rename y Remove (con confirmación
  explícita; borrar un remoto no toca las ramas locales, pero se avisa de que
  sus ramas remotas desaparecen del repo).
- Refrescar refs y salida al panel de Output tras cada operación.

## Criterios de aceptación

- [ ] Añadir un remoto con URL válida aparece en la sidebar y en el diálogo de
      Pull sin reiniciar.
- [ ] Editar la URL y renombrar funcionan y refrescan refs.
- [ ] Remove pide confirmación y explica el efecto.
- [ ] Nombre duplicado o inválido y URL vacía se comunican sin error crudo.
- [ ] Tests de integración en repo temporal (add/rename/set-url/remove).

## Fuera de alcance

- Credenciales: las sigue resolviendo el credential helper del sistema.
- `insteadOf`, `push url` separada y fetch refspecs a medida.
- Crear el repositorio remoto desde la app.

## Notas técnicas

- `git remote rename` actualiza también las ramas de tracking locales: no hay
  que hacer nada extra, pero conviene refrescar refs y status.
- Validar el nombre con `git check-ref-format` no aplica a remotos; usar
  `git remote add` como validación y propagar su stderr.
