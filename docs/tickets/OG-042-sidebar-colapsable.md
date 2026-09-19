# OG-042 · Sidebar estilo SourceTree

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** done
- **Depende de:** OG-040
- **Referencias:** ROADMAP.md, OG-040

## Contexto

OG-040 ya calcula y pinta los commits entrantes/salientes por rama con badges ↓/↑. Lo que falta para parecerse a SourceTree es la estructura del panel: hoy `RefsSidebar`, `StashSidebar` y `ExtrasSidebar` se apilan siempre expandidos, sin forma de plegarlos, y con muchos remotos el panel se vuelve inmanejable.

## Alcance

- Secciones colapsables con chevron: Workspace, Branches, Remotes, Tags, Stashes, Submodules.
- Cada remoto (`origin`, `upstream`…) es un nodo colapsable con sus ramas dentro.
- Estado de plegado persistido por sección.
- Revisar la presentación del badge ↓ existente para que se lea como en SourceTree (`12↓` alineado a la derecha de la fila).

## Criterios de aceptación

- [ ] Cada sección se pliega y despliega con el chevron, y el estado sobrevive al reinicio.
- [ ] Las ramas remotas cuelgan de su remoto, plegable de forma independiente.
- [ ] El badge de commits por descargar se ve alineado a la derecha de la rama.
- [ ] Teclado: la cabecera de sección es un botón con `aria-expanded`.
- [ ] Tests: plegado, persistencia y agrupación por remoto.

## Fuera de alcance

- Reordenar secciones por arrastre.
- Recalcular incoming/outgoing (ya hecho en OG-040).

## Notas técnicas

- La agrupación por remoto sale de `refs/remotes/<remote>/<rama>`; ojo con ramas que contienen `/` en el nombre: el remoto es solo el primer segmento.
- Persistir el plegado junto al resto de layout (`LAYOUT_KEYS`) para no inventar otro mecanismo.
