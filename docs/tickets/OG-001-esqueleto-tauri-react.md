# OG-001 · Esqueleto Tauri 2 + React

- **Milestone:** M0 — Fundación
- **Estado:** in-progress
- **Depende de:** —
- **Referencias:** ADR-0001, ADR-0002, ADR-0005

## Contexto

No existe código. Antes de implementar vistas hace falta una app que compile en los tres SO y un mínimo de calidad automatizada.

## Alcance

- Proyecto Tauri 2 con frontend React + TypeScript y Vite.
- Layout base de la ventana: sidebar izquierdo, zona central (grafo/log) y panel inferior (salida), sin funcionalidad.
- Scripts npm: `dev`, `tauri`, `lint`, `typecheck`, `test`.
- ESLint + Prettier para frontend; `rustfmt` + `clippy` para Rust.
- Vitest configurado con un test de humo del componente raíz.
- GitHub Actions: matriz macOS/Windows/Linux con lint, typecheck, tests de Rust y build de la app.

## Criterios de aceptación

- [x] `npm run tauri dev` abre una ventana con el layout base en macOS. _(verificado arrancando el binario debug con el layout embebido; queda la prueba visual con `tauri dev`)_
- [x] `npm run lint`, `npm run typecheck` y `npm run test` pasan.
- [x] `cargo test` y `cargo clippy -- -D warnings` pasan en `src-tauri`.
- [ ] CI verde en los tres SO. _(workflow escrito; se verifica al hacer push)_
- [x] Decidida la librería de estado global (Zustand) y registrada en ADR-0005.

## Fuera de alcance

- Cualquier llamada real a git.
- Diseño visual definitivo, temas y atajos.

## Notas técnicas

- Estructura prevista: `src/` (React) y `src-tauri/` (Rust), descrita en `docs/guides/development.md`.
- Mantener la configuración de Tauri 2 con capacidades mínimas; los permisos se amplían cuando haga falta.
- No añadir dependencias de UI pesadas todavía.

## Notas de cierre (2026-09-18)

- Versiones: Tauri 2.11.5, React 19.1, Vite 8.3, TypeScript 6.0, Vitest 5, ESLint 10, Zustand 5.0, Rust 1.98.1.
- El único comando de núcleo es `app_version`, que alimenta el indicador "núcleo vX.Y.Z" del toolbar; sirve de prueba de extremo a extremo del bridge.
- Se eliminaron del template `tauri-plugin-opener` y `serde`/`serde_json` por no usarse (regla 5 de AGENTS.md); volverán cuando haga falta.
- Pendiente para cerrar: push y CI verde, más la prueba visual de `npm run tauri dev`.
