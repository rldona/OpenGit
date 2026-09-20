# OG-011 · Fetch, pull y push

- **Milestone:** M2 — Remotos
- **Estado:** in-progress
- **Depende de:** OG-007, OG-008, OG-010
- **Referencias:** ADR-0003, docs/architecture/overview.md

## Contexto

Cierra el ciclo diario: sincronizar con el remoto sin abrir el terminal, con la salida del proceso visible y sin colgar la app.

## Alcance

- Fetch (todas las ramas y con prune opcional), pull (ff-only por defecto) y push.
- Progreso en streaming al panel de salida (porcentajes de transferencia, fases de git).
- Operaciones cancelables; cancelar deja el repo en estado consistente.
- Credenciales vía credential helper del sistema; `GIT_TERMINAL_PROMPT=0` para fallar rápido.
- Errores accionables: non-fast-forward (sugerir pull/rebase), auth fallida, remoto inexistente, rama sin upstream (ofrecer `--set-upstream`).
- Aviso de subida accidental a `main` no deseado (confirmación extra, configurable).

## Criterios de aceptación

- [x] Push a un repo de prueba local (path, sin red) transmite la salida en tiempo real. _(test con bare local y eventos en streaming)_
- [x] Cancelar a mitad de fetch no deja procesos huérfanos ni locks en `.git`. _(test con hook `pre-receive` que duerme: cancela y el job muere en <1 s)_
- [x] Un push rechazado por non-fast-forward muestra causa y siguiente paso. _(mapeo a "Pull first" + test)_
- [x] Sin credenciales configuradas, el error explica cómo configurar el helper, sin pedir password en la app. _(`GIT_TERMINAL_PROMPT=0` y consejo de auth en el mapeo)_
- [x] Tras push/pull, grafo y sidebar se refrescan vía watcher. _(además, el store refresca refs/status/grafo al terminar)_

## Fuera de alcance

- Gestión de tokens/SSH desde la app.
- PRs y revisiones (M5 como mucho, abrir URL).
- Force push (nunca por defecto; si algún día existe, con la palabra de peligro).

## Notas técnicas

- `GIT_PROGRESS_DELAY=0` y `--progress` para forzar progreso en stderr cuando no hay TTY.
- El parseo de progreso es best-effort y nunca bloqueante: la verdad es el exit code.
- Tests con remoto local (`git init --bare` en tempdir), sin red (regla 8 de AGENTS.md).

## Notas de implementación (2026-09-18)

- Runner: `spawn_streaming` con `StreamSink`; el lector separa por `\n` o `\r` (el progreso usa CR) y lo acumula para el resultado. **Sin sink no toca ni un byte** (los parches CRLF deben sobrevivir). La cancelación llega por un token compartido (`Arc<AtomicBool>`) que `wait` revisa cada 100 ms y mata el árbol.
- `src/jobs/`: `JobKind` (fetch/pull/push con prune, remoto y `set_upstream`), `JobManager` (ids y tokens), `start` con eventos `Output`/`Finished`. Comandos `start_remote_job` / `cancel_remote_job`; eventos `job://output` y `job://finished`.
- Push con `set_upstream` resuelve la rama actual y usa `origin` por defecto; pull siempre `--ff-only`; fetch `--all` con `--prune` opcional.
- UI: botones Fetch/Pull/Push y Cancel en la toolbar; confirmación extra al pushear `main`/`master`; push sin upstream activa `--set-upstream` automáticamente.
- `describeRemoteError` mapea la salida a causas accionables (non-fast-forward, auth, remoto inexistente, sin upstream, ref inexistente) con tests.
- Tests: 4 de Rust con remotos locales (push+upstream, fetch, non-ff, cancelación con hook bloqueante) y 11 de frontend (mapeo de errores y store remoto).
- Pendiente para cerrar: PR y CI verde.
