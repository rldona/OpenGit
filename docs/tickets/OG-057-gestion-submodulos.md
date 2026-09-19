# OG-057 · Gestión de submódulos

- **Milestone:** M8 — Paridad SourceTree (fase 3)
- **Estado:** ready
- **Depende de:** OG-024, OG-009
- **Referencias:** ROADMAP.md, OG-024

## Contexto

M5 dejó los submódulos en **modo lectura** y el menú de Branches enseña
`Add Submodule…` deshabilitado. Un submódulo sin inicializar no se puede
arreglar desde la app (justo el caso más común al clonar), y añadir uno nuevo
obliga al terminal.

## Alcance

- Comandos Rust: `submodule_update` (`--init --recursive`), `submodule_sync`
  y `submodule_add` (URL + ruta), con argv y errores tipados.
- Acciones por submódulo en la sidebar: Update (init incluido), Sync y Open
  (ya existe) según su estado; el estado `uninitialized` gana una acción
  destacada.
- Diálogo "Add Submodule…" desde el menú contextual de Branches.
- Salida de git al panel de Output y refresco de extras/status.

## Criterios de aceptación

- [ ] Un submódulo `uninitialized` se inicializa desde la sidebar y pasa a
      estado limpio.
- [ ] Añadir un submódulo en un repo temporal lo registra, lo clona y lo lista.
- [ ] Sync deja las URLs del `.gitmodules` aplicadas sin tocar el índice.
- [ ] Un fallo de red o de URL se muestra como error accionable.
- [ ] Tests de integración con repo temporal y submódulo local (`file://`).

## Fuera de alcance

- Editar `.gitmodules` a mano.
- Submódulos anidados más allá de `--recursive`.
- Deinit/absorber submódulos.

## Notas técnicas

- `git submodule update --init --recursive` puede tardar: usar el patrón de
  jobs si la salida es larga (o timeout amplio y salida al panel).
- Tras cambiar un submódulo, el watcher del repo padre no siempre dispara:
  refrescar extras explícitamente.
