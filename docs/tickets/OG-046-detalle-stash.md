# OG-046 · Detalle de stash como vista

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** backlog
- **Depende de:** OG-030, OG-044
- **Referencias:** ROADMAP.md, OG-030

## Contexto

OG-030 resolvió el diff de un stash con `StashDiffDialog`, un modal. Un modal corta el flujo: no se puede comparar con el historial ni navegar mientras está abierto. Con el layout de 3 zonas de OG-044 ya existe el sitio natural para mostrarlo embebido.

## Alcance

- Al pulsar un stash en la sidebar, la zona principal muestra sus ficheros a la izquierda y el diff del fichero seleccionado a la derecha.
- Cabecera con el mensaje del stash, su rama de origen y acciones Apply / Pop / Drop (Drop con confirmación explícita).
- Retirar `StashDiffDialog` una vez la vista cubre su función.

## Criterios de aceptación

- [ ] Pulsar un stash muestra sus ficheros y el diff sin abrir ningún modal.
- [ ] La cabecera muestra mensaje y rama de origen del stash.
- [ ] Apply/Pop/Drop funcionan desde la vista, y Drop pide confirmación.
- [ ] Tras Pop o Drop la vista se cierra y la lista de stashes se refresca.
- [ ] Tests: selección carga ficheros, confirmación de Drop y refresco posterior.

## Fuera de alcance

- Stash parcial o por fichero.
- Editar el mensaje de un stash.

## Notas técnicas

- Reutilizar el backend de OG-030; esto es reubicación de UI, no nueva funcionalidad de git.
- Drop es destructivo: entra en la regla 1 de AGENTS.md, confirmación explícita obligatoria.
