---
name: commit-graph-layout
description: Use when implementing or debugging the commit graph lanes in the log view (lane assignment, incremental layout, canvas rendering, HiDPI). Triggers on grafo, lanes, graph, commit graph, canvas, topo-order, parents, merges. Covers the lane algorithm, stable colors and performance rules.
---

# Layout del grafo de commits

## Entrada y salida

- Entrada: commits en orden topológico inverso (nuevo → viejo), cada uno con `hash` y `parents`.
- Salida: para cada commit, su **lane** (columna) y las **aristas** hacia sus padres, con la lane de origen y destino. El layout debe ser una función pura `commits -> layout`, testeable sin canvas.

## Algoritmo base (incremental)

1. Mantén un array `lanes` con el hash del commit que cada lane espera como siguiente (el "expectation").
2. Para el commit `C`:
   - Si `C` está en `lanes[i]`, su lane es `i`.
   - Si no (rama nueva), abre una lane libre o añade una al final.
3. Reemplaza `lanes[i]` por el primer padre de `C`. Los padres adicionales (merges) ocupan lanes nuevas o existentes con su hash.
4. Las lanes cuyo hash ya no va a aparecer más se cierran al final de la página; no reordenes las lanes abiertas (provoca saltos visuales).
5. Al cargar la siguiente página, continúa el estado (`lanes`) en vez de recalcular todo.

## Colores

- El color va asociado a la **rama/ref**, no al índice de lane (las lanes se reutilizan y cambiarían de color).
- Un hash de color estable (p. ej. por nombre de rama) que no dependa del orden de llegada.
- En merges, el color del commit es el de su primera lane; las aristas mantienen el color de la lane de la que salen.

## Renderizado

- Canvas 2D solo para el viewport (+ un margen de filas). Filas virtualizadas en DOM para selección y accesibilidad (`aria-hidden` en el canvas).
- Altura de fila fija; `y = index * rowHeight - scrollTop`.
- `devicePixelRatio`: tamaño del canvas en píxeles físicos y `ctx.scale(dpr, dpr)` para trazo nítido.
- Curvas de merge con `quadraticCurveTo` o arcos; los cruces sin conexión se dibujan como "puente" rompiendo la línea.
- No redibujar todo al cambiar la selección: capa de selección/HUD separada o repintado solo de las filas afectadas.

## Tests

Casos mínimos del layout: lineal, root único, merge simple, merge de dos ramas que continúan, octopus, múltiples roots (historial huérfano), rama que nace de un commit antiguo y cargas incrementales por páginas cuyos límites caen en mitad de un merge.

## Anti-patrones

- `O(n²)` buscando el hash en todas las lanes: indexa por hash → lane.
- Recalcular el layout completo al paginar.
- Dibujar todos los commits en el DOM.
- Colores por índice de lane.
- Medir texto dentro del bucle de pintado.
