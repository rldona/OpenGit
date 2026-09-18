# OG-011 · Fetch, pull y push

- **Milestone:** M2 — Remotos
- **Estado:** backlog
- **Depende de:** OG-007, OG-008, OG-010
- **Referencias:** ADR-0003, docs/architecture/overview.md

## Contexto

Cierra el ciclo diario: sincronizar con el remoto sin abrir el terminal, con la salida del proceso visible y sin colgar la app.

## Alcance

- Fetch (todas las ramas y con prune opcional), pull (ff-only por defecto) y push.
- Progreso en streaming al panel de salida (porcentajes de transferencia, fases de git).
- Operaciones cancelables; cancelar deja el repo en estado consistente (git aborta solo cuando es seguro).
- Credenciales vía credential helper del sistema; `GIT_TERMINAL_PROMPT=0` para fallar rápido y con mensaje claro.
- Errores accionables: non-fast-forward (sugerir pull/rebase), auth fallida, remoto inexistente, rama sin upstream (ofrecer `--set-upstream`).
- Aviso de subida accidental a `main` no deseado (confirmación extra, configurable).

## Criterios de aceptación

- [ ] Push a un repo de prueba local (path, sin red) transmite la salida en tiempo real.
- [ ] Cancelar a mitad de fetch no deja procesos huérfanos ni locks en `.git`.
- [ ] Un push rechazado por non-fast-forward muestra causa y siguiente paso.
- [ ] Sin credenciales configuradas, el error explica cómo configurar el helper, sin pedir password en la app.
- [ ] Tras push/pull, grafo y sidebar se refrescan vía watcher.

## Fuera de alcance

- Gestión de tokens/SSH desde la app.
- PRs y revisiones (M5 como mucho, abrir URL).
- Force push (nunca por defecto; si algún día existe, con la palabra de peligro).

## Notas técnicas

- `GIT_PROGRESS_DELAY=0` y `--progress` para forzar progreso en stderr cuando no hay TTY.
- El parseo de progreso es best-effort y nunca bloqueante: la verdad es el exit code.
- Tests con remoto local (`git init --bare` en tempdir), sin red (regla 8 de AGENTS.md).
