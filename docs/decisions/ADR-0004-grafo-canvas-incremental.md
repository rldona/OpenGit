# ADR-0004 · Grafo de commits en canvas con carga incremental

- **Estado:** aceptado
- **Fecha:** 2026-09-18
- **Decisores:** Raúl López

## Contexto

La vista de grafo es la seña de identidad de SourceTree y su punto más débil en repos grandes. Un commit con SVG/DOM por nodo y por segmento no escala: a partir de unos miles de commits el scroll se degrada y el layout bloquea el hilo principal.

## Decisión

Renderizar **lanes y conexiones en `<canvas>` 2D** con las filas de commits virtualizadas en DOM. El historial se carga por páginas (`git log --topo-order` con `--max-count`/`--skip`) y el layout de lanes se calcula incrementalmente al vuelo.

## Alternativas consideradas

- **SVG/DOM por commit** — selección, hit-testing y accesibilidad gratis, pero coste de nodos inasumible con 10 000+ commits.
- **WebGL** — capacity de sobra, pero complejidad innecesaria para 10 000–100 000 segmentos.

## Consecuencias

- Scroll fluido con historial largo; solo se dibuja el viewport (+ margen).
- Hit-testing, hover y selección se implementan a mano sobre el layout calculado (coordenadas commit ↔ x/y).
- La accesibilidad se garantiza con la lista virtualizada en DOM: el canvas es decorativo (`aria-hidden`) y la selección vive en las filas.
- El layout debe ser una función pura y testeable (`commits -> lanes`), sin depender del canvas, para poder cubrirlo con unit tests.
- Cuidado con `devicePixelRatio` (canvas nítido en pantallas HiDPI) y con el color de las lanes en tema claro/oscuro.
