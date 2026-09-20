# OG-038 · Menús contextuales

- **Milestone:** M6 — Paridad visual con SourceTree
- **Estado:** done
- **Depende de:** OG-037
- **Referencias:** ROADMAP.md

## Contexto

Todas las acciones exigen botones visibles o el panel de detalle. SourceTree concentra las acciones por elemento en menús de click derecho (commits, ramas, tags, ficheros).

## Alcance

- Componente `ContextMenu` + hook `useContextMenu`: se abre en la posición del cursor, se cierra con click fuera, Escape o al elegir; `role="menu"`/`menuitem`, ítems con variante `danger`, posición limitada al viewport y renderizado en portal.
- **Commits** (historial): View diff, Cherry-pick, Revert, Reset to here, Interactive rebase from here, Copy hash. Las acciones se extraen a un hook `useCommitActions` compartido con el panel de detalle (sin duplicar lógica ni confirmaciones).
- **Refs**: ramas (Checkout, Rename, Delete, Copy name), tags (Push, Delete, Copy name) y ramas remotas (Checkout, Copy name).
- **File status**: Open diff, Stage/Unstage, Discard (con confirmación), Delete untracked (con confirmación), Copy path.
- **Diff**: lista de ficheros con Select, Stage/Unstage file y Copy path.
- `copyText` sin dependencias nuevas: `navigator.clipboard` con fallback a `document.execCommand`.

## Criterios de aceptación

- [x] Click derecho en un commit abre el menú con las seis acciones y cada una ejecuta lo mismo que el panel de detalle.
- [x] Click derecho en ramas/tags/remotes abre su menú y las acciones destructivas siguen pidiendo confirmación.
- [x] Click derecho en filas de status/diff ofrece las acciones del elemento y Copy path copia la ruta.
- [x] El menú se cierra con Escape, con click fuera y tras elegir un ítem.
- [x] Tests: componente, acciones de commit, refs y status.

## Fuera de alcance

- Submenús anidados, atajos mostrados en el menú e iconos por ítem.
- Menú nativo del sistema para el click derecho (se usa HTML en el WebView).
- Selección múltiple o acciones por lote.

## Notas técnicas

- `useCommitActions` centraliza showDiff/cherry-pick/revert/reset/rebase con sus confirmaciones; `CommitDetail` pasa a usarlo.
- El menú vive en un portal al `body` con `position: fixed`; el hook devuelve `{ open, close, menu }` y cada vista pinta `menu` una vez.
- El menú no roba el foco al abrirse (los ítems son botones); Escape cierra y el click en un ítem cierra antes de ejecutar.

## Notas de implementación (2026-09-18)

- `ContextMenu` (portal, `position: fixed` con clamp al viewport) y hook `useContextMenu` en `lib/hooks/` (separado para respetar `react-refresh/only-export-components`).
- `useCommitActions` centraliza show diff, cherry-pick, revert, reset y rebase con sus confirmaciones; `CommitDetail` y el menú del historial comparten el hook.
- `copyText` sin plugins: `navigator.clipboard` con fallback a `document.execCommand`.
- Menús: commits (6 acciones), ramas (Checkout/Rename/Delete/Copy name, Delete deshabilitado en la rama actual), tags (Push/Delete/Copy name), ramas remotas (Checkout/Copy name), status (Open diff/Stage o Unstage/Discard/Delete/Copy path) y diff (Select/Copy path).
- Tests: 224 frontend (3 del menú, 3 de integración) y 120 Rust intactos.
- Cerrado el 2026-09-18 con CI verde (Frontend 36 s, Rust 2m16s) en el PR #35.
