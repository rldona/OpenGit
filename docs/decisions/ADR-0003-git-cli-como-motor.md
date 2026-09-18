# ADR-0003 · El binario `git` del sistema como motor

- **Estado:** aceptado
- **Fecha:** 2026-09-18
- **Decisores:** Raúl López

## Contexto

La app necesita leer historial, calcular diffs y ejecutar operaciones que escriben en el repositorio. Hay tres caminos habituales: invocar el `git` del sistema, enlazar `libgit2` o usar `gitoxide` (gix). La fidelidad con el comportamiento real de git (hooks, filtros, configuración, credenciales, LFS, submódulos) es un requisito de facto.

## Decisión

Usar el **binario `git` del sistema** para todas las operaciones de escritura y la mayoría de lectura. `gix` queda como opción futura solo para lecturas calientes, nunca como motor de escritura.

## Alternativas consideradas

- **libgit2 (`git2-rs`)** — rápida para leer, pero diverge de git en casos límite y no ejecuta hooks ni respeta toda la configuración; históricamente es la fuente de bugs sutiles en clientes gráficos.
- **gitoxide (`gix`) puro** — excelente rendimiento y seguridad en memoria, pero cobertura incompleta en operaciones de escritura y en comportamientos dependientes de configuración.

## Consecuencias

- Las credenciales, hooks, atributos, filtros LFS y `includeIf` funcionan "gratis" porque usa el git del usuario.
- El rendimiento depende de `git`; en repos grandes se mitiga con consultas acotadas (`--max-count`, paginación) y sin parsear HTML/logs humanos.
- Obligación de parseo robusto: `-z`, `--porcelain=v2`, `--format` con separadores NUL. Ver skill `git-cli-parsing`.
- Versión mínima soportada: **git 2.34+**; se detecta al abrir repo y se avisa si es anterior.
- Los procesos se lanzan con `GIT_TERMINAL_PROMPT=0` (nunca colgarse pidiendo credenciales por consola), `LC_ALL=C` y cancelación por kill del árbol de procesos.
