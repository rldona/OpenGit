# OG-013 · Scroll fluido del grafo (sin parpadeo)

- **Milestone:** M1 — MVP local
- **Estado:** done
- **Depende de:** OG-004
- **Referencias:** ADR-0004, .ai/memory/performance.md

## Contexto

Al hacer scroll rápido en el historial, el grafo parpadea y va a saltos respecto a las filas. El canvas se movía con `style.top = scrollTop` y se redibujaba en un `useEffect` (después del paint), reasignando además el buffer (`canvas.width`) en cada evento de scroll. SourceTree no presenta este problema.

## Alcance

- Canvas como capa fija (overlay) dentro del contenedor de la lista, sin reposicionarlo con el scroll.
- Redibujo sincronizado con el scroll vía `requestAnimationFrame` (coalescido), antes del paint.
- Reasignar el buffer del canvas solo cuando cambian tamaño o `devicePixelRatio`.
- Actualizar el DOM de filas solo al cruzar límites de fila (no en cada píxel de scroll).

## Criterios de aceptación

- [ ] Scroll rápido sin parpadeo ni desincronía entre el grafo y las filas.
- [ ] Sin renders de React por evento de scroll (solo al cambiar la ventana visible).
- [ ] Sin reasignación del buffer del canvas por frame.

## Fuera de alcance

- Cambiar el algoritmo de layout (OG-004) o el motor de render (canvas).

## Notas técnicas

- Función pura `visibleRange(scrollTop, viewportHeight, rowCount, overscan)` con tests.
- El canvas pasa a ser hijo de un contenedor `position: relative` y la lista scrolleable se superpone con `z-index: 1`.

## Notas de implementación (2026-09-18)

- `GraphCanvas` ya no recibe `scrollTop`/`viewportHeight`: observa el scroller (`scroll` pasivo + `ResizeObserver`), lee `scrollTop` en el momento del dibujo y repinta en el siguiente `requestAnimationFrame`.
- El buffer se redimensiona solo si cambia el tamaño o el DPR; el resto de frames solo cambian `ctx` y pintan filas visibles.
- `HistoryView` calcula la ventana visible con `visibleRange` y solo actualiza estado al cruzar una fila; las filas se posicionan en `index * ROW_HEIGHT` (sin aritmética por píxel).
- Cerrado el 2026-09-18 con CI verde (Frontend 28 s, Rust 2m9s) en el PR #7.
