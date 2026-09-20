# OG-060 · Drag & drop para merge y staging

- **Milestone:** M8 — Paridad SourceTree (fase 3)
- **Estado:** ready
- **Depende de:** OG-049, OG-044, OG-009
- **Referencias:** ROADMAP.md, OG-038

## Contexto

SourceTree permite arrastrar una rama sobre el historial para fusionarla y
arrastrar ficheros entre Staged y Unstaged para moverlos del index. Hoy todo
pasa por menús contextuales o checkboxes: funciona, pero se echa en falta el
gesto.

## Alcance

- Arrastrar una rama de la sidebar y soltarla sobre la lista de commits (o la
  fila de HEAD): pide confirmación indicando origen y destino y ejecuta el
  merge de OG-049.
- Arrastrar filas de ficheros entre las secciones Staged y Unstaged de la
  ventana de commit: stage al soltar en Staged y unstage al soltar en
  Unstaged.
- Feedback visual durante el arrastre (destino resaltado) y cancelación con
  Escape.

## Criterios de aceptación

- [ ] Arrastrar una rama y soltarla sobre el historial abre la confirmación y,
      aceptada, fusiona en la rama actual.
- [ ] Soltar la rama actual o una no fusionable no hace nada (sin confirmación).
- [ ] Arrastrar un fichero a la otra sección lo mueve del índice y refresca.
- [ ] Con el ratón (pointer events), sin romper el click normal de selección.
- [ ] Tests con eventos de puntero sobre la UI mockeada.

## Fuera de alcance

- Arrastrar hunks o líneas.
- Arrastrar entre repositorios distintos.
- Reordenar columnas por arrastre.

## Notas técnicas

- Usar Pointer Events (ya se usan en splits y columnas) y `dataTransfer` solo
  para tipar el payload; en WebView el DnD nativo puede ser inconsistente, así
  que valorar un arrastre propio (pointermove + hit test) si falla.
- El merge reutiliza `useMergeBranch` (confirmación + vista de conflictos).
- Para staging, las filas ya saben su sección; el drop solo decide la acción.
