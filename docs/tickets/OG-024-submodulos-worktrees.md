# OG-024 · Submódulos y worktrees en modo lectura

- **Milestone:** M5 — Pulido
- **Estado:** done
- **Depende de:** OG-010
- **Referencias:** ROADMAP.md

## Contexto

Un repo con submódulos o varios worktrees no muestra esa información en la app: para abrir un worktree hay que usar el selector de carpetas y los submódulos son invisibles.

## Alcance (v1)

- Backend: `submodule_status` (`git submodule status`, sin recursión) y `worktree_list` (`git worktree list --porcelain`), con parsers puros.
- Sidebar: secciones **Submodules** y **Worktrees**, visibles solo si hay entradas.
  - Submodule: path, commit corto y estado (**Clean**, **Different commit**, **Not initialized**, **Conflict**).
  - Worktree: path, rama (o **detached**), marca del worktree actual y aviso si está **locked** o **bare**.
- Abrir un worktree o un submódulo inicializado como repositorio con el `open` existente; el actual no se ofrece.
- Refresco con los eventos del watcher y con el atajo Refresh (`mod+R`).
- Solo lectura: no se añaden, quitan ni actualizan submódulos, ni se crean o borran worktrees.

## Criterios de aceptación

- [x] Repo con dos worktrees (rama y detached): se listan con su rama y el actual marcado.
- [x] Submodule: **Clean** al día, **Not initialized** tras `deinit` y **Different commit** al avanzar el submódulo; el commit mostrado es el del índice/HEAD del sub.
- [x] Click en worktree o submódulo inicializado abre ese repo y el sidebar se refresca.
- [x] Parser robusto: path con espacios, `(describe)` final, entradas `bare`/`locked` y líneas de estado `+`/`-`/`U`.
- [x] Tests: parsers unitarios, integración Rust con repos temporales y frontend (store y sidebar).

## Fuera de alcance

- `submodule add/update/sync/deinit` y `worktree add/remove/prune/lock` desde la app.
- Submódulos recursivos o anidados más allá del primer nivel.
- Mostrar el contenido de los submódulos en File status o en el diff.

## Notas técnicas

- `git submodule status` no tiene modo `-z`: se parsea por líneas (char de estado + SHA + path + `(describe)` final). El `describe` se detecta con `rfind(" (")` exigiendo que la línea acabe en `)`.
- Worktrees con `--porcelain`: bloques separados por línea vacía (`worktree`, `HEAD`, `branch`, `detached`, `bare`, `locked`).
- El estado del submódulo respecto al índice del superproyecto: ` ` al día, `+` distinto commit, `-` sin inicializar, `U` conflicto.
- Un worktree puede apuntar a un subdirectorio del repo principal; no se abre solo, el usuario decide (mismo flujo que `open`).

## Notas de implementación (2026-09-18)

- Rust: modelos `Submodule`/`SubmoduleState` y `Worktree`; parsers `parse_submodule_status` y `parse_worktree_list`; comandos `submodule_status` y `worktree_list`.
- Los parsers son estrictos: una línea o estado desconocido devuelve `InvalidOutput` en vez de inventar datos.
- Frontend: `ExtrasSidebar` sobre el store `extras`; solo aparece si hay submódulos, más de un worktree o un error; el worktree actual y los submódulos sin inicializar se muestran deshabilitados.
- El refresh del atajo `mod+R` y los eventos del watcher (refs/refresco) recargan las listas.
- En tests, `git submodule add` local exige `protocol.file.allow=always` y el avance se commitea en el clon del submódulo (no en el repo origen); anotado en `.ai/memory/git-quirks.md`.
- Tests: 104 Rust (5 de parsers y 2 de integración nuevos), 169 frontend (8 nuevos de store y sidebar).
- Cerrado el 2026-09-18 con CI verde (Frontend 28 s, Rust 1m29s) en el PR #20.
