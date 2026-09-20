# OG-004 · Vista de log con grafo

- **Milestone:** M1 — MVP local
- **Estado:** backlog
- **Depende de:** OG-003
- **Referencias:** ADR-0004, skill `commit-graph-layout`

## Contexto

Es la vista principal y el mayor diferencial frente a SourceTree: mismo grafo, pero fluido en repos grandes.

## Alcance

- Lista de commits con columnas: grafo, refs, hash corto, autor, fecha y subject.
- Grafo en canvas: lanes, colores estables por rama, merge/branch de merges.
- Badges de refs: `HEAD`, rama local, rama remota, tag.
- Layout de lanes como función pura e incremental, testeada al margen del canvas.
- Carga paginada con scroll infinito (`--topo-order`, `--parents`, `--max-count`/`--skip`).
- Filtro por rama/ref y opción "todas las ramas" (incluir remotos).
- Selección de commit sincronizada con el panel de detalle.

## Criterios de aceptación

- [ ] Repo de 10 000 commits: primera pintura < 500 ms y scroll sin tirones.
- [ ] El layout se verifica con unit tests que cubren merges, octopus, ramas huérfanas y root commit.
- [ ] Los colores de una rama son estables entre refrescos y sesiones.
- [ ] Cargar más commits no recalcula el layout ya pintado de forma errónea (sin saltos visuales).
- [ ] `devicePixelRatio` produce canvas nítido en pantallas HiDPI.

## Fuera de alcance

- Reordenar por fecha plana (solo topo-order por ahora).
- Búsqueda de commits (M3).
- Selección múltiple y rangos.

## Notas técnicas

- Las filas se renderizan en DOM virtualizado; el canvas es decorativo (`aria-hidden`) y la selección vive en la fila (ADR-0004).
- Fechas en formato relativo ("hoy 08:52", "ayer") calculadas en el frontend a partir de timestamp + offset del commit.
- Evitar re-render de toda la lista al cambiar la selección (memorización por fila).
