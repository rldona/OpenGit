# OG-002 · Abrir repositorio y recientes

- **Milestone:** M1 — MVP local
- **Estado:** done
- **Depende de:** OG-001, OG-003
- **Referencias:** docs/architecture/overview.md

## Contexto

Punto de entrada de la app: elegir una carpeta y validarla como repositorio git, con una lista de recientes para volver a los habituales.

## Alcance

- Selector de carpeta nativo (Tauri dialog).
- Validación del directorio como repo git (incluye subcarpetas de un repo).
- Lista de recientes persistida (ruta, última apertura), con eliminar de la lista.
- Estados de error claros: no es un repo, repo sin commits, repo en estado raro (`HEAD` inválido), git no instalado o versión < 2.34.
- Detección de subcarpeta: ofrecer abrir la raíz del repo.

## Criterios de aceptación

- [x] Abrir un repo con historial muestra la raíz detectada y entra en la vista principal. _(validación en `repo::open` + vista con nombre, ruta, rama y HEAD)_
- [x] Repo vacío (sin commits) se abre sin errores y con estado vacío explícito. _(tests de Rust + mensaje en la UI)_
- [x] Versión insuficiente de git produce un error legible, no un crash. _(`GitError::GitTooOld`; sin test automatizado con un git antiguo)_
- [x] Los recientes persisten entre reinicios y no contienen rutas duplicadas. _(`recent_repos.json` en el directorio de datos; test de deduplicación y recarga)_
- [x] Repo en detached HEAD se abre correctamente. _(test de Rust)_

## Fuera de alcance

- Clonar repositorios.
- Repos bare (solo se mostrará un aviso de no soportado de momento).

## Notas técnicas

- Validación con `git rev-parse --show-toplevel --is-inside-work-tree -z`-equivalente (salida simple, sin ambigüedad de rutas) y `git rev-parse --verify HEAD` para "sin commits".
- Persistencia en el directorio de datos de la app (Tauri store), nunca en el repo del usuario.

## Notas de implementación (2026-09-18)

- Rust: módulo `src/repo/` con `open()` (raíz, nombre, commits, rama/detached/HEAD, versión de git) y `recents::Recents` (JSON, tope de 10, deduplicado por ruta). Comandos Tauri en `src/commands.rs`: `git_version`, `open_repo`, `recent_repos`, `remove_recent_repo`; estado en `AppState` (runner + recientes).
- Validación: `rev-parse --is-inside-work-tree` distingue no-repo (exit ≠ 0), bare (`false`) y work tree (`true`); `symbolic-ref --short -q HEAD` + `rev-parse --verify --quiet HEAD` cubren rama, detached, repo vacío y HEAD inválido.
- Dependencias nuevas justificadas por el ticket: `tauri-plugin-dialog` (selector nativo) y `serde_json` (persistencia de recientes).
- UI: botón en toolbar + estado vacío, lista de recientes en el sidebar (con quitar), resumen del repo abierto y errores en banner; todo el output de la app pasa al panel de salida.
- Tests: 7 de Rust (repo + recientes) y 7 de frontend (App y stores); `cargo clippy -D warnings`, `rustfmt`, ESLint, Prettier, `tsc` y build limpios.
- Cerrado el 2026-09-18: CI verde (Frontend 18 s, Rust 1m4s) tras corregir el lock con `registry=https://registry.npmjs.org/` en el `.npmrc` del repo (el Artifactory corporativo rompía CI).
