# OG-058 · Worktrees gestionables

- **Milestone:** M8 — Paridad SourceTree (fase 3)
- **Estado:** ready
- **Depende de:** OG-024
- **Referencias:** ROADMAP.md, OG-024

## Contexto

La sidebar lista worktrees y permite abrirlos, pero no crear ni eliminar: hoy
es una lista informativa. Los worktrees son la alternativa barata a clonar
para trabajar en dos ramas a la vez, y gestionarlos requiere terminal.

## Alcance

- Comandos Rust: `worktree_add` (ruta + rama nueva o existente) y
  `worktree_remove` (con confirmación; `--force` solo tras aviso explícito de
  que hay cambios sin commitear).
- UI: marcar el worktree actual en la lista, acciones "New worktree…" y
  "Remove" en el menú contextual de la sección y de cada entrada.
- Abrir un worktree sigue funcionando como hoy (abre el repo hijo).

## Criterios de aceptación

- [ ] Crear un worktree con rama nueva lo lista marcado como no actual y se
      puede abrir.
- [ ] Crear un worktree sobre una rama existente falla con mensaje claro si ya
      está en uso por otro worktree.
- [ ] Remove pide confirmación; si hay cambios sin commitear avisa y solo
      fuerza tras aceptar.
- [ ] El worktree principal no se puede eliminar (lo impide git; mensaje claro).
- [ ] Tests de integración en repo temporal.

## Fuera de alcance

- Mover worktrees existentes.
- `worktree lock/unlock` y `prune`.
- Abrir dos worktrees en pestañas (multi-repo queda fuera del hito).

## Notas técnicas

- `git worktree remove` sin `--force` ya falla si hay cambios: usar ese fallo
  como señal, igual que el force-delete de ramas (OG-008).
- La lista de worktrees vive en `useExtrasStore`; refrescarla tras cada
  operación y al recibir eventos de refs.
