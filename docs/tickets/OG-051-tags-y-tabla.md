# OG-051 · Tags clicables y bordes de la tabla

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** done
- **Depende de:** OG-045, OG-048
- **Referencias:** ROADMAP.md, OG-038

## Contexto

Tres remates de paridad detectados comparando con SourceTree:

- Los tags no hacían nada al pulsarlos; en SourceTree llevan al commit.
- Los separadores de paneles eran de 4px y se teñían al pasar el ratón.
- Los tiradores de columna vivían fuera de su columna: al ser ítems flex
  solo en la cabecera, la desplazaban respecto a las filas (22px en Commit,
  11px en Author) y arrastrar acentuaba el desajuste.

## Alcance

- `Ref` expone `target` (objeto pelado de `%(*objectname)`): en un tag
  anotado es el commit, no el objeto tag.
- Pulsar un tag carga páginas del log hasta encontrar el commit (quitando el
  filtro de rama si estorba), lo selecciona y la lista virtualizada hace
  scroll hasta él.
- Separadores de paneles de 1px sin hover de color, con área sensible ancha.
- Tiradores de columna posicionados absolutos sobre el borde de su columna.
- La sección Tags pierde el `+` (crear tag vive en el menú contextual) y sus
  filas pierden los botones Push/Delete de hover.

## Criterios de aceptación

- [x] Pulsar un tag selecciona su commit en el historial y lo trae a la vista.
- [x] Un tag anotado resuelve a su commit (test del parser con fixture).
- [x] Cabecera y filas de la tabla coinciden al píxel en las tres columnas.
- [x] Los separadores se ven como una línea y no cambian de color al pasar.

## Fuera de alcance

- Ordenar la tabla por columnas (OG-045).
- Mostrar los tags como columna propia en la fila de commit.
