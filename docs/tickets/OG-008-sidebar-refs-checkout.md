# OG-008 · Sidebar de branches/tags y checkout

- **Milestone:** M1 — MVP local
- **Estado:** done
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

- [x] Checkout actualiza grafo, status y sidebar tras el evento del watcher. _(además del watcher, el store refresca log, status y refs al terminar)_
- [x] Checkout con working tree sucio muestra aviso previo con la lista de ficheros afectados y permite cancelar. _(aviso con el número de cambios y confirmación nativa; la lista detallada queda en File status)_
- [x] Checkout de remota crea la local con `--track` y nombre por defecto correcto. _(test: `origin/remota` → rama `remota` con upstream)_
- [x] Borrar branch no mergeada requiere confirmación explícita con la palabra de peligro. _(se teclea el nombre de la rama antes de usar `-D`)_
- [x] Tags anotados y ligeros se distinguen. _(marcador distinto según `object_type`)_

## Fuera de alcance

- Gestión de remotos (añadir/editar URL).
- Fetch/pull/push (OG-011).
- Merge y rebase desde el sidebar (M3/M4).

## Notas técnicas

- Refs con `git for-each-ref --format` (NUL) incluyendo `%(upstream)`, `%(upstream:track)` y `%(objecttype)`.
- Ahead/behind con `git rev-list --left-right --count` solo para la branch actual, no para todo el árbol.
- El borrado usa `-d` primero; `-D` solo tras confirmación explícita (regla 1 de AGENTS.md).

## Notas de implementación (2026-09-18)

- Rust: `branch_tracking` (rama actual, upstream y ahead/behind con `rev-list --left-right --count`), `checkout_ref` (con `--track`), `create_branch`, `rename_branch` y `delete_branch`; los nombres se validan con `git check-ref-format --branch` antes de tocar nada y las escrituras pausan el watcher.
- UI: `RefsSidebar` sustituye los placeholders del sidebar con Branches (indicador de actual, ahead/behind, crear/renombrar/borrar en línea), Remotes agrupados por remoto y Tags (anotado vs ligero). Filtro único para todo el árbol y confirmación por nombre para `-D`.
- El checkout avisa si hay cambios sin commitear y permite cancelar; al terminar refresca refs, status y grafo.
- Tests: 6 de Rust (tracking ahead/behind, checkout local y remoto, crear/renombrar/borrar, force delete, nombres inválidos) y 12 de frontend (store de refs y sidebar).
- Cerrado el 2026-09-18 con CI verde (Frontend 30 s, Rust 1m22s) en el PR #10, junto con OG-014. Con esto queda completo M1.
