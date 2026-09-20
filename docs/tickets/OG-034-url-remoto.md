# OG-034 · Abrir la URL del remoto

- **Milestone:** M5 — Pulido
- **Estado:** in-progress
- **Depende de:** OG-008
- **Referencias:** ROADMAP.md

## Contexto

La app muestra ramas remotas pero no la URL del remoto, y el roadmap permite como único extra de hosting «abrir la URL del remoto». Hoy hay que copiarla desde el terminal.

## Alcance

- Backend: `remote_urls` lista los remotos con `git remote` + `git remote get-url <name>` y calcula una URL web cuando es posible.
  - Conversión pura `remote_web_url`: `https://`, `http://`, `ssh://`, `git://` y formato scp (`git@host:org/repo.git`) → `https://host/org/repo`; las rutas locales y `file://` no son abribles.
- UI: botón **↗** junto al nombre de cada remoto en el sidebar de refs cuando su URL web existe; abre el navegador del sistema.
- Apertura con `tauri-plugin-opener` (nueva dependencia justificada: Tauri 2 no expone apertura de URLs externas sin plugin) y permiso de capability limitado a `http://` y `https://`.
- Los remotos se cargan en el store `extras` junto al resto de metadatos del repo.

## Criterios de aceptación

- [x] `remote_web_url` convierte https/scp/ssh/git y rechaza rutas locales y `file://`.
- [x] `remote_urls` lista nombre, URL y URL web de cada remoto del repo.
- [x] El sidebar muestra el botón solo para remotos con URL web y llama al opener con esa URL.
- [x] La capability limita la apertura a `http`/`https`.
- [x] Tests: unidad de la conversión, integración de `remote_urls`, store y sidebar.

## Fuera de alcance

- Clonar, añadir o editar remotos.
- Abrir ficheros locales o rutas `file://` (queda restringido a http/https).
- Integraciones de hosting (PRs, issues).

## Notas técnicas

- **Dependencia nueva justificada:** `tauri-plugin-opener` (crate 2 y `@tauri-apps/plugin-opener`) es la vía oficial de Tauri 2 para abrir URLs en el navegador del sistema; evita `window.open`, que abriría una ventana del WebView.
- El permiso va con scope explícito: `{ "identifier": "opener:allow-open-url", "allow": [{ "url": "https://*" }, { "url": "http://*" }] }`.
- La conversión no valida que el host exista; solo normaliza el texto. Los remotos sin URL web simplemente no muestran botón.

## Notas de implementación (2026-09-18)

- Rust: `remote_web_url` (https, ssh con puerto, scp, git://; rechaza rutas locales, unidades Windows y `file://`) y `remote_urls` con `git remote` + `get-url` por nombre; comando registrado.
- Plugin `tauri-plugin-opener` (crate y npm) con capability scope a http/https; hallazgo anotado en `.ai/memory/tauri.md`.
- UI: `RefsSidebar` lee los remotos del store `extras` y pinta **↗** por remoto con URL web; el resto no muestra botón.
- Tests: 120 Rust (3 nuevos) y 204 frontend (2 en el sidebar).
- Pendiente para cerrar: PR y CI verde.
