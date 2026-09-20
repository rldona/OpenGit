# OG-037 · Tabla de commits con cabecera

- **Milestone:** M6 — Paridad visual con SourceTree
- **Estado:** done
- **Depende de:** OG-035, OG-036
- **Referencias:** ROADMAP.md

## Contexto

El historial no tiene cabecera ni columnas: los datos (hash, autor, fecha) van en posiciones fijas de CSS sin ninguna referencia visual, y el grafo flota sobre la lista sin contexto.

## Alcance

- Cabecera fija sobre la lista con las columnas **Graph · Description · Commit · Author · Date**, alineada con las filas (mismo gap y padding, ancho del grafo dinámico).
- Columnas de la fila alineadas con la cabecera: `Description` agrupa badges de refs + asunto y se lleva el espacio flexible; `Commit` (7 caracteres), `Author` y `Date` con ancho fijo.
- El canvas del grafo y la lista arrancan **debajo** de la cabecera (offset de 24 px) para que las filas y el grafo sigan alineados al hacer scroll.
- Asunto y autor con `title` (texto completo) para cuando se truncan con elipsis.
- Sin cambios en virtualización, scroll incremental ni layout del grafo.

## Criterios de aceptación

- [x] La cabecera muestra las cinco columnas y no se desplaza con el scroll.
- [x] Las celdas de cada fila quedan alineadas con su columna y el grafo empieza a la misma altura.
- [x] Los textos largos se truncan con elipsis y muestran el completo en `title`.
- [x] Los tests existentes del historial siguen pasando y hay aserciones de la cabecera.

## Fuera de alcance

- Ordenar por columna (el orden lo define git con `--topo-order`).
- Redimensionar columnas a mano.
- Agrupar por fecha o separadores de día.

## Notas técnicas

- La cabecera repite la estructura de la fila (gap 10 px, padding-right 12 px) y usa `paddingLeft` dinámico igual que las filas para casar con el ancho del grafo.
- `.history-list` y `.history-graph` pasan de `top: 0` a `top: 24px`; la altura del canvas la sigue calculando `GraphCanvas` con `clientHeight`.

## Notas de implementación (2026-09-18)

- Cabecera `.commit-header` con el mismo gap/padding que las filas y `paddingLeft` dinámico igual al ancho del grafo; `Description` agrupa refs + asunto (la columna de refs sigue fija en 220 px dentro de la fila).
- La cabecera es `aria-hidden` (es una guía visual); las filas siguen siendo botones accesibles.
- Lista y canvas bajan 24 px para no quedar bajo la cabecera; virtualización y scroll intactos.
- Asunto y autor con `title` para el texto completo.
- Tests: 218 frontend (aserciones de cabecera en App) y 120 Rust intactos.
- Cerrado el 2026-09-18 con CI verde (Frontend 36 s, Rust 2m7s tras reejecutar el job por un flake del test de watcher, anotado en `.ai/memory/ci.md`) en el PR #34.
