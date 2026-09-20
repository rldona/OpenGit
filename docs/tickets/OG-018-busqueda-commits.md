# OG-018 · Búsqueda de commits

- **Milestone:** M3 — Historial avanzado
- **Estado:** done
- **Depende de:** OG-004
- **Referencias:** ROADMAP.md

## Contexto

Con historiales largos, encontrar un commit por su mensaje, su autor o los ficheros que tocó es imprescindible. El grafo ya tiene filtro por rama; falta la búsqueda.

## Alcance

- Buscar por texto en el mensaje (`--grep`), por autor (`--author`) y por ruta de fichero (`-- <path>`).
- Los tres filtros se combinan (intersección) y conviven con el filtro de rama existente.
- Búsqueda literal (sin regex) para no sorprender con metacaracteres, ignorando mayúsculas.
- Paginación y scroll infinito sobre los resultados.
- Botón para limpiar la búsqueda y volver al historial completo.
- En modo búsqueda la lista se muestra sin lanes (los padres no están en los resultados): nodos en una sola columna.

## Criterios de aceptación

- [x] Buscar por mensaje devuelve solo los commits que lo contienen (literal, sin distinguir mayúsculas). _(test con metacaracteres)_
- [x] Buscar por autor filtra por nombre o correo. _(test)_
- [x] Buscar por fichero devuelve los commits que tocaron esa ruta. _(test)_
- [x] Los filtros se combinan y se pueden limpiar. _(tests + botón Clear)_
- [x] Los resultados paginan y el refresco del watcher mantiene la búsqueda activa. _(test de paginación; el reload del store reaplica la búsqueda)_

## Fuera de alcance

- Búsqueda dentro del contenido de los diffs (`-S`/`-G`).
- Búsqueda en el remoto.
- Historial de búsquedas.

## Notas técnicas

- `git log --fixed-strings --regexp-ignore-case --grep=<texto> --author=<texto> -- <ruta>`, siempre con `-z` y `--format` de separadores.
- El texto del usuario va como argumento (nunca por shell); la ruta va tras `--`.
- En modo búsqueda el layout usa `parents: []` para no dejar lanes abiertas que nunca se cierran.

## Notas de implementación (2026-09-18)

- Rust: `LogSearch { grep, author, path }` y `log_page` ampliado; el comando `log_page` acepta `search`. Tests de grep literal (con metacaracteres), autor, ruta, combinación y paginación.
- Frontend: tres campos compactos en la toolbar del historial (Message, Author, File) con Search/Clear; el store aplica la búsqueda sobre load/loadMore/reload; en modo búsqueda el layout pinta nodos sin lanes.
- Cerrado el 2026-09-18 con CI verde (Frontend 29 s, Rust 2m3s) en el PR #14. Con esto queda completo M3.
