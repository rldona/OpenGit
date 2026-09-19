# OG-045 · Columnas ordenables en la tabla de commits

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** done
- **Depende de:** OG-037, OG-044
- **Referencias:** ROADMAP.md, OG-037

## Contexto

OG-037 dejó la cabecera (Graph, Description, Commit, Author, Date) pero es decorativa: `aria-hidden="true"` y sin interacción (`HistoryView.tsx:188`). Los anchos son fijos por CSS. SourceTree permite ordenar por columna y ajustar anchos.

## Alcance

- Cabecera interactiva: clic ordena ascendente/descendente por Description, Commit, Author o Date; indicador visual de la columna activa.
- Anchos de columna redimensionables por arrastre, persistidos.
- Orden por defecto: el topológico de git (el actual), recuperable con un clic más o con "Reset order".

## Criterios de aceptación

- [x] Clic en una cabecera ordena y el indicador señala columna y sentido.
- [x] Los anchos se ajustan por arrastre y sobreviven al reinicio.
- [x] Se puede volver al orden topológico original.
- [x] Ordenar por una columna **no** rompe el alineamiento del grafo (ver notas).
- [x] Tests: ciclo de ordenación, reset y persistencia de anchos.

## Fuera de alcance

- Añadir o quitar columnas.
- Ordenación en servidor/git (`--date-order` y compañía).

## Notas técnicas

- **Riesgo principal:** el grafo solo tiene sentido en orden topológico. Al ordenar por otra columna las aristas no se pueden dibujar coherentemente. **Decisión tomada:** mientras haya orden por columna se oculta la columna Graph (canvas y cabecera) y el ancho lo aprovecha Description; al volver al topológico reaparece.
- El ciclo de la cabecera es ascendente → descendente → topológico, así el orden de git se recupera con un clic más (no hizo falta un botón Reset).
- La ordenación se hace sobre los commits ya cargados sin romper el virtualizado ni la carga incremental (`loadMore` sigue añadiendo en orden de git y la vista reordena).
