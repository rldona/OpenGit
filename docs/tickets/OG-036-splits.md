# OG-036 · Splits redimensionables

- **Milestone:** M6 — Paridad visual con SourceTree
- **Estado:** done
- **Depende de:** OG-035
- **Referencias:** ROADMAP.md

## Contexto

Los paneles tienen anchos/altos fijos (sidebar 240 px, lista de diff 280 px, salida de altura variable). En SourceTree cada división se arrastra y el tamaño se conserva.

## Alcance

- Componente `SplitPane` reutilizable:
  - horizontal (columnas) o vertical (filas), con el panel fijo al principio o al final;
  - divisor arrastrable con pointer events, mínimo/máximo y `role="separator"` con `aria-valuenow`;
  - redimensionado por teclado con las flechas (±10 px, con Shift ±40);
  - estado plegado (sin divisor) para paneles que se ocultan.
- Persistencia del tamaño por clave en `localStorage` (`opengit.layout.*`), con helpers puros en `lib/layout.ts`.
- Aplicado a:
  - sidebar ↔ contenido (`opengit.layout.sidebar`);
  - salida ↔ resto de la ventana (`opengit.layout.output`, vertical, al final, plegable);
  - lista de ficheros ↔ diff (`opengit.layout.diff-files`);
  - lista de commits ↔ detalle del commit (`opengit.layout.history-detail`, plegable sin selección).

## Criterios de aceptación

- [x] Arrastrar cada divisor redimensiona el panel correspondiente dentro de sus límites.
- [x] Las flechas del divisor ajustan el tamaño con el foco puesto.
- [x] Los tamaños sobreviven a un remount de la vista (localStorage) y los valores corruptos caen al tamaño por defecto.
- [x] Los paneles plegables no muestran divisor cuando están ocultos.
- [x] Tests: helpers de layout, componente (teclado y persistencia) y render de las cuatro integraciones.

## Fuera de alcance

- Doble clic para resetear al tamaño por defecto y snap a posiciones predefinidas.
- Splits anidados configurables por el usuario o layouts guardables.
- Redimensionar columnas internas de la tabla de commits (llega con OG-037).

## Notas técnicas

- El tamaño vive en un `useState` inicializado desde `localStorage`; el drag escucha `pointermove`/`pointerup` en `window` para no perder el gesto al salir del divisor.
- `SplitPane` no impone el layout externo: cada integración le pasa su `className` (`panes`, `diff-body`, `history-body`) para heredar los `flex` existentes.
- Los anchos fijos de CSS (`.sidebar`, `.diff-files`) pasan a ser tamaños por defecto del componente.

## Notas de implementación (2026-09-18)

- `lib/layout.ts`: `LAYOUT_KEYS`, `clampSize`, `loadSize` y `saveSize` (valores corruptos o fuera de rango caen al fallback o se limitan).
- `SplitPane`: divisor con pointer events (escucha en `window` para no perder el gesto), teclado ±10/±40, `role="separator"` con `aria-*`, y modo plegado sin divisor.
- Integraciones: sidebar↔contenido y salida (vertical, plegable al ocultar Output) en App; lista↔diff en DiffView; lista↔detalle en HistoryView (plegado sin selección). Se quitaron los anchos fijos de `.sidebar`, `.diff-files` y `.commit-detail`.
- Tests: 218 frontend (4 de layout y 7 de SplitPane) y 120 Rust intactos.
- Cerrado el 2026-09-18 con CI verde (Frontend 37 s, Rust 2m7s) en el PR #33.
