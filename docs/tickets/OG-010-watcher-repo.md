# OG-010 · Watcher de `.git` y refresco

- **Milestone:** M1 — MVP local
- **Estado:** in-progress
- **Depende de:** OG-003
- **Referencias:** docs/architecture/overview.md, OG-009

## Contexto

El estado del repo cambia por la app y por fuera (terminal, IDE, hooks). La UI debe reflejarlo sin polling y sin tormentas de recargas.

## Alcance

- Observar `.git`: `HEAD`, `refs/`, `index`, `MERGE_HEAD`, `ORIG_HEAD`, `packed-refs`.
- Debounce de 250 ms y agrupación de eventos por tipo (refs, index, working tree).
- Pausa del watcher durante operaciones lanzadas por la app y reanudación con un refresco único al terminar.
- Eventos tipados a la UI: `repo://refs-changed`, `repo://index-changed`, `repo://worktree-changed`.
- Fallback por polling lento (p. ej. 5 s) si el SO no entrega eventos (contenedores, volúmenes de red).

## Criterios de aceptación

- [x] Un commit desde terminal se refleja en < 1 s sin tocar la UI. _(evento de refs/index con debounce; test de integración con repo real)_
- [x] Diez cambios seguidos en el index producen un solo refresco. _(acumulador por tipo + ventana de 250 ms; unit test)_
- [x] Una operación larga de la app no dispara refrescos durante su ejecución. _(pause/resume; unit e integración)_
- [x] El watcher se detiene al cerrar el repo o cambiar de repo (sin fugas de hilos). _(`close_repo` y parada del anterior en `open_repo`)_
- [x] No hay bucles: el propio refresco no vuelve a disparar eventos. _(eventos de acceso ignorados, `GIT_OPTIONAL_LOCKS=0` en lecturas y pausa en las escrituras)_

## Fuera de alcance

- Vigilar el working tree completo (coste alto en repos grandes); el refresco de status se decide por eventos de `.git` y por acciones explícitas.
- Índice de búsqueda de ficheros.

## Notas técnicas

- Crate recomendada: `notify` + `notify-debouncer-mini`. Se usa solo `notify` y el debounce se implementa con una ventana de 250 ms en el hilo del watcher.
- En macOS, `FSEvents` da eventos a nivel de directorio; no asumir path por fichero.
- Durante `fetch/pull/push` el watcher también se pausa para no reaccionar a `FETCH_HEAD`.

## Notas de implementación (2026-09-18)

- `src/watch/mod.rs`: `notify` con modo recursivo sobre `.git`, clasificación de rutas (`index`, `refs/**`, `HEAD`/`packed-refs`/`ORIG_HEAD`/`MERGE_HEAD`/…), descarte de eventos de acceso (anti-bucles) y acumulador por tipo para agrupar. Fallback a polling de 5 s si el watcher no se puede crear.
- Pausa: contador atómico; los comandos de escritura (`stage`, `unstage`, `discard`, `delete_untracked`) pausan el watcher y al reanudar emiten un único `repo://refreshed`.
- La UI (`useRepoEvents`) escucha los cuatro eventos: refs y refresco recargan el historial (silencioso, conserva selección y filtro); index y worktree refrescan el status.
- Al cerrar el repo (botón Cerrar) o abrir otro, el watcher anterior se detiene y se libera el hilo.
- Dependencia nueva justificada por el ticket: `notify` 8.2.
- Pendiente para cerrar: PR y CI verde.
