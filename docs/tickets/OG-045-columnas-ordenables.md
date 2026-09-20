# OG-045 · Columnas ordenables en la tabla de commits

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** backlog
- **Depende de:** OG-037, OG-044
- **Referencias:** ROADMAP.md, OG-037

## Contexto

OG-037 dejó la cabecera (Graph, Description, Commit, Author, Date) pero es decorativa: `aria-hidden="true"` y sin interacción (`HistoryView.tsx:188`). Los anchos son fijos por CSS. SourceTree permite ordenar por columna y ajustar anchos.

## Alcance

- Cabecera interactiva: clic ordena ascendente/descendente por Description, Commit, Author o Date; indicador visual de la columna activa.
- Anchos de columna redimensionables por arrastre, persistidos.
- Orden por defecto: el topológico de git (el actual), recuperable con un clic más o con "Reset order".

## Criterios de aceptación

- [ ] Clic en una cabecera ordena y el indicador señala columna y sentido.
- [ ] Los anchos se ajustan por arrastre y sobreviven al reinicio.
- [ ] Se puede volver al orden topológico original.
- [ ] Ordenar por una columna **no** rompe el alineamiento del grafo (ver notas).
- [ ] Tests: ciclo de ordenación, reset y persistencia de anchos.

## Fuera de alcance

- Añadir o quitar columnas.
- Ordenación en servidor/git (`--date-order` y compañía).

## Notas técnicas

- **Riesgo principal:** el grafo solo tiene sentido en orden topológico. Al ordenar por otra columna las aristas no se pueden dibujar coherentemente. La decisión previsible es ocultar o atenuar la columna Graph mientras haya una ordenación distinta a la de por defecto; conviene confirmarla antes de implementar.
- La ordenación debe hacerse sobre los commits ya cargados sin romper el virtualizado ni la carga incremental (`loadMore` sigue añadiendo al final del orden de git, no del orden mostrado).
