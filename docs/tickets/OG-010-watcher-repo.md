# OG-010 · Watcher de `.git` y refresco

- **Milestone:** M1 — MVP local
- **Estado:** backlog
- **Depende de:** OG-003
- **Referencias:** docs/architecture/overview.md

## Contexto

El estado del repo cambia por la app y por fuera (terminal, IDE, hooks). La UI debe reflejarlo sin polling y sin tormentas de recargas.

## Alcance

- Observar `.git`: `HEAD`, `refs/`, `index`, `MERGE_HEAD`, `ORIG_HEAD`, `packed-refs`.
- Debounce de 250 ms y agrupación de eventos por tipo (refs, index, working tree).
- Pausa del watcher durante operaciones lanzadas por la app y reanudación con un refresco único al terminar.
- Eventos tipados a la UI: `repo://refs-changed`, `repo://index-changed`, `repo://worktree-changed`.
- Fallback por polling lento (p. ej. 5 s) si el SO no entrega eventos (contenedores, volúmenes de red).

## Criterios de aceptación

- [ ] Un commit desde terminal se refleja en < 1 s sin tocar la UI.
- [ ] Diez cambios seguidos en el index producen un solo refresco.
- [ ] Una operación larga de la app no dispara refrescos durante su ejecución.
- [ ] El watcher se detiene al cerrar el repo o cambiar de repo (sin fugas de hilos).
- [ ] No hay bucles: el propio refresco no vuelve a disparar eventos.

## Fuera de alcance

- Vigilar el working tree completo (coste alto en repos grandes); el refresco de status se decide por eventos de `.git` y por acciones explícitas.
- Índice de búsqueda de ficheros.

## Notas técnicas

- Crate recomendada: `notify` + `notify-debouncer-mini` (justificar en el ticket al añadirla).
- En macOS, `FSEvents` da eventos a nivel de directorio; no asumir path por fichero.
- Durante `fetch/pull/push` el watcher también se pausa para no reaccionar a `FETCH_HEAD`.
