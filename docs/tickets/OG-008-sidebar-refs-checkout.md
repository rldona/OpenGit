# OG-008 · Sidebar de branches/tags y checkout

- **Milestone:** M1 — MVP local
- **Estado:** backlog
- **Depende de:** OG-003, OG-010
- **Referencias:** docs/architecture/overview.md

## Contexto

El panel lateral es el patrón de navegación de SourceTree: branches locales, remotas, tags y stashes, con acciones directas.

## Alcance

- Árbol de branches locales con su upstream y ahead/behind; branches remotas agrupadas por remoto; tags ordenados.
- Checkout de branch local; checkout de branch remota creando la local con tracking.
- Crear branch desde un commit, renombrar y borrar (con confirmación y sin `-D` por defecto).
- Búsqueda/filtro en el árbol.
- Indicador de branch actual.

## Criterios de aceptación

- [ ] Checkout actualiza grafo, status y sidebar tras el evento del watcher.
- [ ] Checkout con working tree sucio muestra aviso previo con la lista de ficheros afectados y permite cancelar.
- [ ] Checkout de remota crea la local con `--track` y nombre por defecto correcto.
- [ ] Borrar branch no mergeada requiere confirmación explícita con la palabra de peligro.
- [ ] Tags anotados y ligeros se distinguen.

## Fuera de alcance

- Gestión de remotos (añadir/editar URL).
- Fetch/pull/push (OG-011).
- Merge y rebase desde el sidebar (M3/M4).

## Notas técnicas

- Refs con `git for-each-ref --format` (NUL) incluyendo `%(upstream)`, `%(upstream:track)` y `%(objecttype)`.
- Ahead/behind con `git rev-list --left-right --count` solo para la branch actual, no para todo el árbol.
- El borrado usa `-d` primero; `-D` solo tras confirmación explícita (regla 1 de AGENTS.md).
