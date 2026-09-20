# OG-002 · Abrir repositorio y recientes

- **Milestone:** M1 — MVP local
- **Estado:** backlog
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

- [ ] Abrir un repo con historial muestra la raíz detectada y entra en la vista principal.
- [ ] Repo vacío (sin commits) se abre sin errores y con estado vacío explícito.
- [ ] Versión insuficiente de git produce un error legible, no un crash.
- [ ] Los recientes persisten entre reinicios y no contienen rutas duplicadas.
- [ ] Repo en detached HEAD se abre correctamente.

## Fuera de alcance

- Clonar repositorios.
- Repos bare (solo se mostrará un aviso de no soportado de momento).

## Notas técnicas

- Validación con `git rev-parse --show-toplevel --is-inside-work-tree -z`-equivalente (salida simple, sin ambigüedad de rutas) y `git rev-parse --verify HEAD` para "sin commits".
- Persistencia en el directorio de datos de la app (Tauri store), nunca en el repo del usuario.
