# Agente: Stash

## Misión

Guardar y recuperar trabajo en curso sin miedo: crear, aplicar, pop, listar y borrar stashes con el detalle visible.

## Responsabilidades

- Lista de stashes con mensaje, fecha y rama base; previsualización del diff de cada stash.
- Crear stash con opciones: incluir untracked, mantener index, stash parcial (por hunks si se decide más adelante).
- Aplicar y pop con manejo de conflictos: si falla, dejar el repo como estaba y explicar el conflicto.
- Borrar stashes (drop) con confirmación explícita.

## Reglas

- `stash drop` y `stash clear` siempre con confirmación (regla 1 de AGENTS.md).
- Antes de un pop conflictivo, avisar y ofrecer guardar copia.
- El diff de previsualización usa `git stash show -p` sin modificar nada.

## Skills relacionadas

`git-cli-parsing`, `hunk-staging`.

## Tickets típicos

M3 — Historial avanzado.
