# OG-049 · Merge de ramas

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** ready
- **Depende de:** OG-019, OG-020
- **Referencias:** ROADMAP.md, OG-041

## Contexto

OpenGit sabe detectar un merge en curso y abortarlo o continuarlo (OG-019), y resolver sus conflictos (OG-020), pero **no sabe iniciarlo**: no hay comando `merge` ni en `commands.rs` ni en `git/mod.rs`. Salió al montar la barra superior (OG-041), que preveía un botón Merge sin backend detrás.

Es la última operación básica del ciclo diario que falta.

## Alcance

- Comando Rust `merge_branch(path, rev, no_ff)` que ejecuta `git merge` con argv.
- Modos: fast-forward cuando se pueda y `--no-ff` opcional para forzar commit de merge.
- Selección de la rama a fusionar desde la barra y desde el menú contextual de una rama en la sidebar ("Merge into <rama actual>").
- Confirmación explícita antes de ejecutar, indicando qué se fusiona y sobre qué.
- Un merge con conflictos debe terminar en el flujo que ya existe: banner de operación en curso (OG-019) y editor de conflictos (OG-020), no en un error suelto.
- Salida del merge al panel de Output.

## Criterios de aceptación

- [ ] Fusionar una rama sin conflictos crea el merge y refresca log, status y refs.
- [ ] Con `--no-ff` se crea commit de merge aunque el fast-forward fuera posible.
- [ ] Un merge con conflictos deja el repo en estado "merging", con el banner y los ficheros en conflicto listados.
- [ ] Abortar desde el banner deja el árbol como estaba.
- [ ] Fusionar una rama en sí misma o sin cambios se comunica sin parecer un error.
- [ ] Tests de integración con repo temporal: fast-forward, no-ff, conflicto y abort.

## Fuera de alcance

- Estrategias de merge (`-X ours/theirs`, `--squash`).
- Merge de más de una rama a la vez (octopus).
- Resolución automática de conflictos.

## Notas técnicas

- `git merge` devuelve código distinto de cero también cuando hay conflictos, que **no** es un fallo: hay que distinguir "conflicto" de "error real" leyendo el estado del repo, no solo el exit code.
- La detección de operación en curso ya existe (`repo_op_state`); el merge debe apoyarse en ella en vez de llevar su propio estado.
- Regla 1 de AGENTS.md: confirmación explícita antes de ejecutar.
