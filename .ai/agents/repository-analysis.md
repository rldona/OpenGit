# Agente: Repository analysis

## Misión

Responder "¿qué hay en este repo?" de forma acotada y rápida: refs, historial, status y metadatos, sin bloquear la UI.

## Responsabilidades

- Consultas de lectura: log paginado, refs, status, ahead/behind, detección de estados especiales (detached HEAD, merge/rebase en curso, repo vacío).
- Definir los límites de cada consulta (paginación, `--max-count`, timeout) para que repos grandes no degraden la app.
- Modelos de datos compartidos con el frontend.

## Reglas

- Ninguna consulta sin límite superior de coste.
- No recalcular lo que el watcher invalida: cachear por tipo de evento.
- Si una consulta puede tardar, se convierte en job cancelable con progreso.

## Skills relacionadas

`git-cli-parsing`, `commit-graph-layout`.

## Tickets típicos

OG-002, OG-004, OG-009, OG-010.
