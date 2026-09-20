# OG-052 · Búsqueda de commits (v2)

- **Milestone:** M8 — Paridad SourceTree (fase 3)
- **Estado:** ready
- **Depende de:** OG-018, OG-044
- **Referencias:** ROADMAP.md, OG-018

## Contexto

OG-018 implementó la búsqueda por mensaje, autor y ruta en la toolbar del
historial. La paridad visual de M7 retiró esa UI (ocupaba sitio y duplicaba
filtros), pero el backend `log_page` sigue aceptando `LogSearch` y el store se
quedó sin acciones de búsqueda: hoy no se puede buscar y SourceTree sí.

## Alcance

- UI de búsqueda en el historial como modo, no como tres campos sueltos:
  campo de mensaje siempre visible y autor/ruta plegables; botón Clear.
- Contador de resultados y estado "no results" cuando la búsqueda no devuelve
  nada, sin confundirlo con "repo vacío".
- Atajo `mod+f` para enfocar la búsqueda (se retiró con la UI; vuelve).
- El filtro de rama y la búsqueda se combinan.
- Con búsqueda activa el layout se aplana (los padres fuera del resultado no
  dibujan aristas), como ya hacía OG-018.

## Criterios de aceptación

- [ ] Buscar por mensaje filtra el log y muestra el número de resultados.
- [ ] Autor y ruta filtran igual y se pueden combinar entre sí y con la rama.
- [ ] Clear vuelve al log completo sin perder el filtro de rama.
- [ ] `mod+f` enfoca el campo de búsqueda.
- [ ] Repo sintético de 10 000 commits: la búsqueda se resuelve sin bloquear la
      UI y sin recargar más de una página.
- [ ] Tests de store y de UI con el bridge mockeado.

## Fuera de alcance

- Expresiones regulares o `git grep` sobre contenido.
- Historial de búsquedas recientes.
- Búsqueda dentro de un diff.

## Notas técnicas

- Reintroducir `applySearch`/`clearSearch` en `useLogStore` sobre el `search`
  que ya conoce `logPage(path, skip, take, rev, search)`.
- `Ctrl+F` ya no existe en `SHORTCUTS`: recuperar la entrada y el foco.
- Mantener el virtualizado: la búsqueda recarga desde la página 0.
