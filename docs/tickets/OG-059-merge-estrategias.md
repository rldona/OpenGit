# OG-059 · Estrategias de merge y Merge en el menú nativo

- **Milestone:** M8 — Paridad SourceTree (fase 3)
- **Estado:** ready
- **Depende de:** OG-049
- **Referencias:** ROADMAP.md, OG-049

## Contexto

OG-049 dejó el merge con `--no-ff` y nada más. Quedan fuera los dos modos que
SourceTree ofrece en "Advanced": `--squash` y resolver con una estrategia
(`-X ours/theirs`). Además, el menú nativo tiene Fetch/Pull/Push pero no
Merge, que ya existe en la barra.

## Alcance

- `merge_branch` acepta `squash: bool` y `strategy: "ours" | "theirs" | null`
  (validado en Rust, nunca interpolado).
- Diálogo Merge: casilla "Squash changes" y selector de estrategia en un
  apartado "Advanced" con aviso de qué hace cada una.
- Con `--squash` el resultado deja los cambios en el index sin commit: la UI
  lo explica y no espera commit de merge.
- Entrada **Merge…** en el menú nativo que abre el diálogo.

## Criterios de aceptación

- [ ] Squash en un merge con conflicto resuelto deja los cambios staged y sin
      commit, y se comunica.
- [ ] `-X ours`/`-X theirs` resuelven los conflictos de contenido sin dejar la
      operación a medias.
- [ ] Estrategia inválida no llega a git (validación en Rust).
- [ ] El menú nativo abre el mismo diálogo que la barra.
- [ ] Tests de integración: squash, ours, theirs y validación de estrategia.

## Fuera de alcance

- Merge de octopus y `--strategy-option` que no sean ours/theirs.
- Guardar la estrategia como preferencia por repo.

## Notas técnicas

- `--squash` no escribe `MERGE_HEAD`, así que "conflicto" y "éxito" se leen
  igual que hoy, pero el post-merge no debe esperar commit: ajustar el texto
  de la ventana y el refresco.
- `-X ours/theirs` solo aplica a conflictos de contenido; los de rename/borrado
  siguen necesitando resolución manual y el flujo de conflictos.
