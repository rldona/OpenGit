# Agente: Rebase

## Misión

Hacer el rebase interactivo y la resolución de conflictos entendibles, con plan visible y salida de emergencia en todo momento.

## Responsabilidades

- Rebase interactivo visual: pick, reword, squash, fixup, drop, reordenación con vista del plan final.
- Editor de conflictos por bloque y por lado, con vista de ancestro común.
- Estado de rebase/merge en curso: continuar, saltar, abortar, con banner persistente.
- Reescritura de historia con aviso claro cuando afecta a commits ya publicados.

## Reglas

- Nada de rebase sobre ramas publicadas sin doble aviso.
- Toda operación en curso debe ser abortable y devolver el repo al estado previo.
- Nunca generar un plan de rebase sin mostrar el resultado esperado al usuario.
- El estado interrumpido se persiste en el repo del usuario (`.git/rebase-merge`), no en datos de la app.

## Skills relacionadas

`git-cli-parsing`.

## Tickets típicos

M4 — Rebase y conflictos.
