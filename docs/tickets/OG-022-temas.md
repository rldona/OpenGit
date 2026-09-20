# OG-022 · Tema claro/oscuro

- **Milestone:** M5 — Pulido
- **Estado:** in-progress
- **Depende de:** —
- **Referencias:** ROADMAP.md

## Contexto

La UI nació con un único tema oscuro. Los tokens están centralizados en `:root` (`global.css`), pero quedan restos fuera de tokens: estados semánticos (aviso, error, añadido, borrado, badge), la paleta del grafo y el tema `oneDark` de CodeMirror. No hay selector ni persistencia.

## Alcance (v1)

- Preferencia de tema: **system** (por defecto), **light** y **dark**.
- `system` sigue `prefers-color-scheme` y reacciona en caliente a los cambios del SO.
- Selector "Theme" en la toolbar.
- Persistencia en `localStorage` (preferencia de UI, sin IPC, para no retrasar la primera pintura).
- `data-theme` en `<html>` con script inline en `index.html` para evitar el flash de tema al arrancar.
- Tokens semánticos por tema: superficies, borde, texto, hover, aviso, peligro, añadido/borrado, badge de tag, `--accent-fg` y anillo de selección del grafo.
- Diff (CodeMirror): `oneDark` en oscuro y resaltado claro (`defaultHighlightStyle`) en claro; se reconstruye al cambiar de tema.
- `color-scheme` por tema para scrollbars nativos.

## Criterios de aceptación

- [x] Cambiar el selector aplica el tema al instante en toda la UI (incluidos diff y grafo) sin recargar.
- [x] La preferencia sobrevive al reinicio; `system` sigue al SO y reacciona en caliente.
- [x] Sin flash de tema incorrecto al arrancar (script previo a React).
- [x] Tests: resolución system/light/dark, persistencia, listener de `matchMedia` y selector en App.
- [x] Ningún estado semántico usa colores solo pensados para fondo oscuro; todos pasan por token con variante clara.

## Fuera de alcance

- Temas personalizados, alto contraste o más de una paleta clara/oscura.
- Sincronización de la preferencia entre equipos.
- Cambiar el tema nativo de la ventana de Tauri.

## Notas técnicas

- `src/lib/theme.ts` (tipos, `resolveTheme`, persistencia, `systemPrefersDark`) + `src/lib/stores/theme.ts` (zustand) + efecto en `App` para `data-theme` y listener de `matchMedia`.
- Tokens nuevos en `global.css`: `--warning-*`, `--danger*`, `--add`, `--del`, `--add-bg`, `--del-bg`, `--tag-annotated`, `--accent-fg`.
- El grafo usa su propia paleta (`layout.ts`); v1 la mantiene y añade el color del anillo de selección según el tema.

## Notas de implementación (2026-09-18)

- Backend sin cambios: la preferencia vive en localStorage y un script inline en `index.html` fija `data-theme` antes de montar React.
- Los 32 colores hardcodeados de `global.css` pasan a tokens; `[data-theme="light"]` redefine paleta y `color-scheme`.
- `DiffEditor` elige `oneDark` o `syntaxHighlighting(defaultHighlightStyle)` y se reconstruye al cambiar de tema; `GraphCanvas` usa `selectionRingColor`.
- Tests: 147 frontend (12 nuevos de tema, store y selector), 97 Rust intactos.
