# Contribuir

Proyecto personal, pero con reglas claras para que el trabajo (humano o agente) sea predecible.

## Flujo

1. Todo cambio nace de un ticket en `docs/tickets/`. Si no existe, se crea primero.
2. El ticket pasa a `in-progress` y se trabaja en una rama con su ID: `feat/OG-004-graph-log`.
3. Commits en [Conventional Commits](https://www.conventionalcommits.org/): `feat(graph): añade lanes incrementales`.
4. Antes de cerrar: lint, typecheck y tests en verde.
5. PR contra `main` con el ID del ticket en el título. El PR cierra el ticket (`Closes OG-004`).

## Convenciones

- **Idioma:** documentación e issues en español; código, identificadores, ramas y mensajes de commit en inglés.
- **Decisiones:** cualquier decisión que cueste revertir (dependencia pesada, modelo de datos, protocolo UI↔Rust) requiere un ADR en `docs/decisions/` usando `TEMPLATE.md`.
- **Tickets:** un fichero por ticket, formato en `docs/tickets/README.md`. Estados: `backlog`, `ready`, `in-progress`, `blocked`, `done`.
- **Commits atómicos:** un commit = un cambio con sentido propio. Nada de "wip" en `main`.

## Estilo de código

- Rust: `cargo fmt` + `cargo clippy` (sin warnings nuevos).
- TypeScript: `npm run lint` + `npm run typecheck`; componentes funcionales y hooks.
- Sin comentarios que repitan el código. Los comentarios explican *por qué*, no *qué*.
- Nada de secretos, tokens ni rutas personales en el repo.

## Operaciones git sensibles

La app no debe ejecutar operaciones destructivas sin confirmación explícita del usuario: `reset --hard`, `push --force`, `clean -fd`, `branch -D`, `stash drop`. En el repositorio de desarrollo, aplica la misma regla a los agentes.
