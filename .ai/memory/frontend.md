# Frontend

## El canvas no hereda variables CSS

- **Fecha:** 2026-09-18
- **Contexto:** tema claro/oscuro (OG-022); el anillo de selección del grafo se pintaba con `#ffffff` fijo.
- **Hallazgo:** `GraphCanvas` dibuja con la API 2D y su contexto no resuelve `var(--…)`; cualquier color tematizado debe llegar en JS. Leerlo con `getComputedStyle` en cada frame de scroll es innecesario.
- **Implicación:** los colores de canvas viven en helpers JS (`selectionRingColor` en `lib/theme.ts`); si crecen, centralizarlos ahí y no leer el DOM en `draw()`.

## CodeMirror: `oneDark` incluye el resaltado; el tema claro necesita `defaultHighlightStyle`

- **Fecha:** 2026-09-18
- **Contexto:** el diff usaba `oneDark` fijo (OG-006) y en tema claro quedaba ilegible.
- **Hallazgo:** `oneDark` aporta tema y highlight style; sin él no hay colores de sintaxis. Para el tema claro basta `syntaxHighlighting(defaultHighlightStyle)` de `@codemirror/language`. El editor se reconstruye al cambiar de tema incluyéndolo en las deps del efecto.
- **Implicación:** cualquier extensión de CodeMirror dependiente del tema debe entrar en las deps del efecto que crea la vista.

## Preferencias de UI en localStorage con script inline anti-flash

- **Fecha:** 2026-09-18
- **Contexto:** persistir el tema sin IPC y sin ver un frame oscuro antes de que React monte.
- **Hallazgo:** en Tauri el WebView persiste localStorage por origen (en dev, `http://localhost:1420`). Un script inline en `index.html` puede leer la clave y fijar `data-theme` antes de cargar el bundle; el store de zustand lee el mismo valor al inicializarse.
- **Implicación:** las preferencias de UI van a localStorage; el estado compartido con el core (recents) sigue en `app_data_dir`. Mantener ambos scripts en sintonía (`THEME_STORAGE_KEY`).
