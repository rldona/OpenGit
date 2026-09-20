# Copilot instructions

La fuente única de instrucciones del proyecto es [`AGENTS.md`](../AGENTS.md). Resumen operativo:

- OpenGit: cliente Git de escritorio multiplataforma (Tauri 2 + Rust + React + TypeScript).
- El motor es el binario `git` del sistema; nunca se reimplementa git.
- Documentación en español; código, ramas y commits en inglés (Conventional Commits).
- Todo cambio nace de un ticket `OG-NNN` en `docs/tickets/`.
- Prohibido: operaciones destructivas sin confirmación, commits/push sin pedirlo, interpolar entrada en shell, parsear salida humana de git, secretos en el repo.
- Parseo siempre con `-z` / `--porcelain=v2`. Tests de git contra repos temporales, nunca contra la red.
- Decisiones con coste alto de revertir → ADR en `docs/decisions/`.
