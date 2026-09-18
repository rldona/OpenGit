# OG-035 · Chrome de la ventana

- **Milestone:** M6 — Paridad visual con SourceTree
- **Estado:** in-progress
- **Depende de:** OG-001, OG-023
- **Referencias:** ROADMAP.md

## Contexto

La app funciona pero su chasis no se parece al de SourceTree: no hay menú nativo, la toolbar mezcla acciones y estado sin iconos, no se muestra la ruta del repo en el título y falta una barra de estado.

## Alcance

- **Menú nativo** (Tauri Menu API, sin plugins nuevos):
  - macOS: menú de aplicación (About, Quit) + `File`, `Edit`, `View`, `Repository`, `Help`.
  - `File`: Open Repository…, Close Repository.
  - `Edit`: los predefinidos (undo/redo/cut/copy/paste/select all) — necesarios para que los atajos de edición funcionen en macOS.
  - `View`: File status, History, Diff, Output, Keyboard shortcuts.
  - `Repository`: Fetch, Pull, Push, Refresh, Close.
  - `Help`: Documentation (abre el repo en el navegador).
  - Los clics emiten un evento `menu-action` con el id; la UI los enruta a los mismos handlers que los atajos. **Los ítems no llevan acelerador** (salvo el menú Edit predefinido): el teclado lo sigue gestionando `useShortcuts` para no duplicar ejecuciones.
- **Toolbar** con grupos e iconos SVG propios (sin dependencias): repositorio (Open, Fetch, Pull, Push, Refresh, Close) y vistas (Output, Shortcuts, Theme).
- **Título de la ventana** con la ruta del repo (`/ruta/al/repo` o `OpenGit` sin repo) vía Window API.
- **Barra de estado** inferior: rama actual y número de cambios a la izquierda; versión del core a la derecha (se mueve desde la toolbar).

## Criterios de aceptación

- [x] El menú nativo aparece en macOS/Linux/Windows y cada ítem dispara su acción al hacer clic.
- [x] Edit contiene los predefinidos: copiar/pegar funciona en los campos de texto.
- [x] La toolbar agrupa acciones y vistas, con iconos y nombres accesibles (los tests existentes siguen pasando).
- [x] El título de la ventana muestra la ruta del repo abierto y vuelve a `OpenGit` al cerrarlo.
- [x] La barra de estado muestra rama, cambios y versión del core.
- [x] Tests del enrutado del menú (evento → acción), del título y de la status bar.

## Fuera de alcance

- Aceleradores nativos en los menús (los atajos web ya cubren el teclado).
- Personalizar el menú de macOS más allá de About/Quit (servicios, hide, etc.).
- Iconos de sistema operativo o packs externos.

## Notas técnicas

- `menu-action` se emite desde Rust en `setup()` con `app.on_menu_event`; el frontend escucha en `lib/bridge/events.ts` con `listen("menu-action")`.
- El enrutado reutiliza el mapa de handlers que ya usa `useShortcuts`, así que añadir una acción al menú no duplica lógica.
- El título se fija con `getCurrentWindow().setTitle(...)` desde un envoltorio en `lib/bridge/window.ts` (mockeable en tests).

## Notas de implementación (2026-09-18)

- Rust: `build_menu` en `lib.rs` con submenús File/Edit/View/Repository/Help (más el menú de app en macOS); `on_menu_event` emite `menu-action` con el id. Solo Edit lleva aceleradores (predefinidos); el resto no, para no pisar a `useShortcuts`.
- Frontend: `subscribeMenuEvents` en `lib/bridge/events.ts`; App enruta el evento a los mismos handlers de los atajos mediante un ref; `Icon` propio (SVG inline, sin dependencias); toolbar agrupada (repositorio + vistas); barra de estado con rama, conflictos, cambios y versión del core (movida desde la toolbar).
- Título de ventana con la ruta del repo (`lib/bridge/window.ts`).
- Tests: 207 frontend (título, status bar y enrutado de menú) y 120 Rust intactos.
- Pendiente para cerrar: PR y CI verde.
