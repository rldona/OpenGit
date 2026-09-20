# OG-047 · Ancho del grafo por rango visible

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** ready
- **Depende de:** OG-044
- **Referencias:** ROADMAP.md, OG-004, OG-037

## Contexto

En un repo con muchas ramas aparecen ~300 px muertos entre las líneas del grafo y el texto de los commits. La causa está en `HistoryView.tsx`:

```ts
const laneCount = rows.reduce((max, row) => Math.max(max, row.lane + 1, …), 1);
const graphWidth = laneCount * LANE_WIDTH + GRAPH_PADDING;
```

`laneCount` es el máximo sobre **todos** los commits cargados, no sobre los visibles, y `graphWidth` se aplica como `paddingLeft` a cada fila. Si en algún punto de los 200 commits cargados hay 27 lanes, todas las filas se indentan 390 px aunque en pantalla solo se vean 5. Y empeora con cada `loadMore`.

## Alcance

- Calcular el ancho del grafo sobre el **rango visible**, no sobre todas las filas.
- Tope máximo de ancho: pasado un número de lanes el grafo se recorta en vez de empujar el texto.
- Evitar que el ancho baile en cada scroll: histéresis o redondeo a bloques, de forma que el texto no se mueva en horizontal mientras se navega.
- `GraphCanvas` debe repintar con el ancho efectivo y mantener el alineamiento fila a fila.

## Criterios de aceptación

- [ ] En un repo con muchas ramas no hay hueco muerto entre las lanes y la descripción.
- [ ] Al hacer scroll el texto de los commits no se desplaza horizontalmente de forma visible.
- [ ] Con más lanes que el tope, el grafo se recorta y el texto sigue legible.
- [ ] `loadMore` no aumenta la indentación de las filas ya visibles.
- [ ] Tests: ancho calculado sobre el rango, tope aplicado y estabilidad ante scroll.

## Fuera de alcance

- Cambiar el algoritmo de asignación de lanes.
- Scroll horizontal del grafo.

## Notas técnicas

- La histéresis es la parte delicada: recalcular el ancho en cada `updateRange` hace que el texto tiemble. Conviene que el ancho solo crezca dentro de una sesión de scroll, o redondear a múltiplos de N lanes.
- El canvas y las filas comparten el mismo origen: cualquier cambio de ancho tiene que aplicarse a los dos a la vez o se desalinean los dots.
