# OG-048 · Identidad visual (badges, iconos, fechas)

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** ready
- **Depende de:** —
- **Referencias:** ROADMAP.md, OG-022, OG-037

## Contexto

M6 colocó los elementos donde toca, pero comparando capturas contra SourceTree la app sigue sin parecerse, y no es por la disposición sino por el acabado: los badges de ref son casi todos del mismo tono lavado (relleno al 18 % de alfa, sin icono), las secciones de la sidebar no tienen icono, el autor sale sin email y las fechas son absolutas.

Este ticket recoge lo que M7 no tiqueteó: la **identidad visual**, no la estructura.

## Alcance

- **Badges de ref:** glifo por tipo (rama, rama remota, tag) y color saturado distinguible de un vistazo: local, remota y tag deben leerse como tres cosas distintas sin acercarse.
- **Iconos de sección** en la sidebar (Workspace, Branches, Tags, Remotes, Stashes, Submodules), como ancla visual de cada bloque.
- **Fechas relativas** en la tabla: `Today at 22:17`, `Yesterday at …`, y absoluta a partir de cierta antigüedad.
- **Autor con email** en la columna Author (`Nombre <email>`), truncado con elipsis.
- Revisar la densidad de fila y el resalte de la fila seleccionada (SourceTree marca la selección en todo el ancho).
- Todo debe funcionar en tema claro y oscuro (OG-022).

## Criterios de aceptación

- [ ] Rama local, rama remota y tag se distinguen por color y glifo sin leer el texto.
- [ ] Cada sección de la sidebar tiene su icono.
- [ ] Las fechas recientes se muestran relativas y las antiguas absolutas.
- [ ] La columna Author muestra nombre y email, truncando sin romper la fila.
- [ ] La fila seleccionada se resalta en todo el ancho.
- [ ] Contraste suficiente en ambos temas.
- [ ] Tests: formateo de fechas (hoy, ayer, antigua) y clasificación de badge por tipo de ref.

## Fuera de alcance

- Iconos personalizables o packs de iconos.
- Cambiar la familia tipográfica.
- Avatares de autor (SourceTree los pinta; requiere red o caché local, y la regla 8 prohíbe red en tests).

## Notas técnicas

- El formateo relativo necesita una referencia de "ahora" inyectable para que los tests sean deterministas; nada de `Date.now()` directo dentro del componente.
- Los colores van como variables CSS del tema, no incrustados, para no romper OG-022.
- `renderRefs` ya recorta a 3 refs con un `+N`: al añadir glifos hay que revisar que la fila siga sin desbordarse.
