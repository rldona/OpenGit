# OG-050 · Pull con diálogo y ventana de progreso

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** in progress
- **Depende de:** OG-017, OG-041
- **Referencias:** ROADMAP.md, OG-039

## Contexto

Pull arranca hoy el job directamente (`git pull --ff-only --progress`) y su salida
va al panel de Output, que además arranca oculto. Un fallo solo deja un `error` en
el store de remoto que **no se pinta en ninguna parte**: desde la UI parece que no
pasa nada. Tampoco se puede elegir remoto ni rama, ni ver el progreso.

SourceTree resuelve esto con tres ventanas encadenadas: opciones → progreso → error.
Este ticket replica ese flujo para Pull.

## Alcance

- Diálogo al pulsar Pull: remoto, URL del remoto, rama remota (con Refresh), rama
  local de destino (la actual) y opciones:
  - Commit merged changes immediately (por defecto activado) → `--no-commit` si se desmarca.
  - Include messages from commits being merged in merge commit → `--log`.
  - Create new commit even if fast-forward merge → `--no-ff`.
  - Rebase instead of merge → `--rebase`.
- Ventana de progreso con barra, salida en streaming, `Cancel` y `Show Full Output`.
- Si falla, la misma ventana pasa a estado de error con la salida y un botón `Close`.
- `JobKind::Pull` acepta remoto y rama explícitos; el título de la ventana es
  `Pulling Branch "<rama>" From "<remoto>"`.

## Criterios de aceptación

- [ ] Pull abre el diálogo con remoto y rama por defecto (upstream si existe).
- [ ] OK lanza el job y se ve el progreso; Cancel lo aborta.
- [ ] Un fallo muestra la salida completa y no se queda sin mensaje.
- [ ] Las opciones del diálogo llegan a git (test de `command_for`).
- [ ] Tests de UI con el bridge mockeado.

## Fuera de alcance

- Diálogos equivalentes para Push y Fetch (comparten la ventana de progreso/error).
- `--squash`, `--autostash` y rebase interactivo.
- Resolver el conflicto de historias no relacionadas que git rechaza sin `--allow-unrelated-histories`.
