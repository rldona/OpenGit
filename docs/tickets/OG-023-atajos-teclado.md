# OG-023 · Atajos de teclado

- **Milestone:** M5 — Pulido
- **Estado:** in-progress
- **Depende de:** —
- **Referencias:** ROADMAP.md

## Contexto

Todas las acciones exigen ratón y no hay forma de descubrir atajos. M5 incluye atajos de teclado como parte del pulido.

## Alcance (v1)

- Mapa global de atajos (`mod` = Cmd en macOS, Ctrl en el resto):
  - `mod+O` abrir repositorio; `mod+R` refrescar status, refs e historial.
  - `mod+Enter` commit (con mensaje y staged, misma validación que el panel).
  - `mod+F` buscar en el historial (cambia a History y enfoca el campo Message).
  - `mod+1` File status, `mod+2` History, `mod+3` Diff.
  - `?` ayuda de atajos; `Esc` cierra la ayuda o limpia la selección.
- Ayuda integrada: diálogo con los atajos agrupados y agrupaciones por contexto; botón `?` en la toolbar como entrada visible.
- Los atajos no se disparan al escribir en `input`, `textarea` o `select`; solo los que llevan `mod` atraviesan campos de texto.
- `preventDefault()` en los atajos capturados (p. ej. `mod+R` no recarga el WebView).

## Criterios de aceptación

- [x] `mod+O`, `mod+R`, `mod+Enter`, `mod+F`, `mod+1/2/3` ejecutan su acción con el repositorio abierto.
- [x] `?` abre y `Esc` cierra la ayuda; `Esc` sin ayuda limpia el commit seleccionado.
- [x] El diálogo de ayuda lista todos los atajos con la etiqueta correcta de plataforma (⌘/Ctrl) y se cierra con el botón.
- [x] Tests del matcher (mod por plataforma, `?`, `Esc`, ignorar `Alt`), de la ayuda y de las acciones en App.
- [x] Teclear en un campo de texto con un carácter que coincide con un atajo no ejecuta nada.

## Fuera de alcance

- Personalizar o reasignar atajos; importar keybindings de otros clientes.
- Command palette y atajos de navegación del grafo (flechas, siguiente/padre).
- Atajos con estado intermedio (leader keys o secuencias).

## Notas técnicas

- `src/lib/shortcuts.ts` puro: definición de `SHORTCUTS`, `matchesShortcut` y `formatKeys`; `src/lib/hooks/useShortcuts.ts` registra un único listener global con guard de campos editables y handlers en un ref.
- La ayuda es `src/components/ShortcutsHelp.tsx` y se controla desde el store `ui` (`shortcutsOpen`), con un contador `searchFocusRequest` para el foco de `mod+F` sin acoplar componentes por DOM.
- Commit: el recuento de staged se comparte con `CommitPanel` (`stagedEntries` y `hasActiveOperation` exportados desde `stores/commit.ts`).
- Refresco: `reload` de log + `refresh` de status y refs.

## Notas de implementación (2026-09-18)

- `shortcuts.ts` define el mapa completo (`SHORTCUTS`), `matchesShortcut` (mod según plataforma, ignora `Alt`) y `formatKeys` (⌘ en macOS, Ctrl en el resto); se usa `navigator.platform`.
- `useShortcuts` registra un solo listener en `document` con los handlers en un ref para no re-suscribirse; en campos editables solo pasan los atajos con `mod`.
- La ayuda es `ShortcutsHelp` sobre `ui.shortcutsOpen`; `mod+F` usa `searchFocusRequest` para que `HistoryView` enfoque el campo sin acoplarse por DOM.
- De paso, `CommitPanel` reutiliza `stagedEntries`/`hasActiveOperation` en vez de duplicar el filtro.
- Tests: 161 frontend (7 del matcher y formateo, 7 de acciones y ayuda en App), 97 Rust intactos.
- Pendiente para cerrar: PR y CI verde.
