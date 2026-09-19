# OG-044 · Layout de 3 zonas en el historial

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** done
- **Depende de:** OG-036, OG-037, OG-039
- **Referencias:** ROADMAP.md, docs/architecture/overview.md

## Contexto

Hoy `HistoryView` es un split horizontal: a la izquierda grafo + tabla de commits, a la derecha un `CommitDetail` estrecho con metadatos y botones. Para ver el diff de un commit hay que pulsar "View diff", lo que llama a `useCommitActions.showDiff` y **navega fuera** a la vista `diff` (`useCommitActions.ts:30-36`), perdiendo de vista el historial.

SourceTree no navega: al seleccionar un commit la misma pantalla se parte en tres zonas y el diff aparece debajo, manteniendo el contexto del grafo.

## Alcance

- Reestructurar `HistoryView` en un split **vertical**:
  - **Zona superior:** grafo + tabla de commits (lo actual, sin tocar el virtualizado).
  - **Zona inferior:** split horizontal con lista de ficheros del commit | diff del fichero.
  - **Metadatos del commit** (hash, autor, fecha, mensaje completo, padres/refs) en una banda entre ambas zonas, no en la columna derecha.
- Al seleccionar un commit se carga su diff en la zona inferior (`useDiffStore.openCommit`) sin cambiar `activeView`.
- Sin selección, la zona inferior queda colapsada y el historial ocupa toda la altura.
- Tamaños de los dos nuevos splits persistidos vía `LAYOUT_KEYS`.
- Reutilizar los componentes de fichero/parche que ya usa `DiffView`; no duplicar el renderizado de parches.
- Controles del diff (Unified/Side by side, List/Tree) accesibles desde la zona inferior.
- Backend: `%b` en `LOG_FORMAT` para que el mensaje completo llegue a la UI.

## Criterios de aceptación

- [x] Al seleccionar un commit aparecen sus ficheros abajo a la izquierda y el diff a la derecha, sin salir de la vista de historial.
- [x] Los metadatos del commit (autor, fecha, mensaje completo) se ven bajo la lista de commits.
- [x] La zona inferior permite cambiar entre Unified/Side by side y List/Tree.
- [x] Al deseleccionar (Esc) la zona inferior se colapsa y el historial recupera la altura completa.
- [x] Los tamaños de las zonas sobreviven a un reinicio de la app.
- [x] Navegar rápido entre commits no dispara una llamada a git por cada pulsación (ver notas técnicas).
- [x] La vista `diff` independiente sigue funcionando para el working tree.
- [x] Tests: selección carga ficheros, deselección colapsa, y el diff se pide una sola vez por commit estabilizado.

## Fuera de alcance

- Vista de commit para crear (OG-043).
- Ordenación de columnas de la tabla (OG-045).
- Detalle de stash (OG-046).
- Cambios en el algoritmo de lanes o en `GraphCanvas`.

## Notas técnicas

- `openCommit` ejecuta git. Con navegación por teclado se encadenarían llamadas: debounce corto sobre `selected` y descartar respuestas de un hash que ya no es el seleccionado (guard por hash, no solo `cancelled`).
- `useCommitActions.showDiff` deja de ser la ruta principal; se mantiene en el menú contextual pero sin `setActiveView("diff")` cuando ya estamos en historial.
- El virtualizado de la lista depende de `clientHeight` del scroller: al cambiar la altura por el split hay que recalcular `range` (`updateRange` ya existe, falta dispararlo en resize).
- `GraphCanvas` pinta sobre un canvas alineado con el scroller; cualquier cambio de altura obliga a repintar con el DPR correcto.

## Notas de implementación (2026-09-18)

- `DiffView` se parte en `DiffFilesPanel` (lista/árbol + filtro) y `DiffPatchPanel` (parche, LFS, binario), ambos alimentados del store. `DiffView` queda como toolbar + composición; el historial reutiliza los mismos paneles en vez de duplicar el renderizado de parches.
- `HistoryView`: el split pasa de horizontal (lista | aside) a **vertical** (lista arriba / `CommitDetailPanel` abajo), con `collapsed={!selectedCommit}`, que además desmonta el panel y evita cargas inútiles.
- `CommitDetailPanel`: banda de metadatos (subject, autor, fecha, hash copiable, padres/refs) + split horizontal ficheros | diff. Las acciones del antiguo `CommitDetail` se mantienen en la banda.
- **Respuestas obsoletas:** el debounce (120 ms) no bastaba, porque dos `openCommit` solapados podían resolverse en orden inverso. El guard real vive en el store (`openToken` en `diff.ts`), que descarta cualquier respuesta que no sea la de la última apertura; `openWorktree` también lo incrementa para que un commit pendiente no pise el working tree.
- El virtualizado de la lista depende de la altura del scroller: se añadió un `ResizeObserver` que recalcula el rango visible cuando el panel inferior cambia la altura.
- "View diff" del menú contextual pasa a llamarse "Open in Diff view": seleccionar la fila ya muestra el diff en línea, así que la entrada queda solo como salto a la vista a pantalla completa.
- `LAYOUT_KEYS.historyDetail` se sustituye por `historyBottom` y `historyFiles`.
- Tests: 236 frontend (antes 232) y 121 Rust. Nuevos: detalle inline, colapso al deseleccionar, debounce de navegación rápida y descarte de respuesta obsoleta en el store.

### Corrección: dos huecos detectados tras la primera pasada

La primera implementación dio por cumplido "mensaje completo" mostrando solo el `subject`, y al reutilizar los paneles de `DiffView` se dejó la zona inferior sin los controles del diff. Ambos cerrados:

- **Cuerpo del commit (backend).** `LOG_FORMAT` terminaba en `%s`, así que el cuerpo ni siquiera salía de git. Ahora es `…%x1f%s%x1f%b`, con `body` en el modelo Rust y en el tipo TS.
  - El cuerpo va **el último a propósito**: contiene saltos de línea y podría contener el propio `0x1f`. El parser pasa de `split_fields` a `splitn(record, FIELD_SEP, 8)`, de modo que cualquier separador sobrante se queda dentro del cuerpo en vez de romper el registro. Los registros siguen separados por NUL (`-z`), que un mensaje de commit no puede contener.
  - `%b` viene con saltos de línea finales sobrantes; se aplica `trim_end` para que un commit sin cuerpo quede como cadena vacía y no como `"\n\n"`.
  - Fixture `log_topo.bin` regenerado con un commit de cuerpo multilínea (con ñ y 日本). Al regenerar, los otros cinco fixtures salieron byte a byte idénticos, lo que confirma que `generate.sh` es determinista.
  - Tests nuevos: cuerpo multilínea sin romper el registro, y cuerpo vacío en el commit raíz. El `assert_eq!(commits.len(), 5)` pasa a 6.
- **Controles del diff.** Banda `commit-diff-toolbar` con Unified/Side by side y List/Tree. `Reverse` y las acciones de staging se quedan fuera a propósito: el diff de un commit es de solo lectura.
- El cambio de tipo TS lo señalaron tres fixtures de test al compilar; ninguno se detectó por fallo en ejecución.
- Tests: 239 frontend (antes 236) y 123 Rust (antes 121).
