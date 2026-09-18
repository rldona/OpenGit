# Workflow: nueva feature

1. **Ticket primero.** Si no existe `OG-NNN`, créalo en `docs/tickets/` con contexto, alcance y criterios de aceptación. Sin ticket no hay rama.
2. **Estado y dependencias.** Comprueba que sus dependencias están `done`. Pásalo a `in-progress` y actualiza el índice de `docs/tickets/README.md`.
3. **Rama.** `feat/OG-NNN-slug` (o `fix/`, `chore/`, `docs/`).
4. **Consulta contexto.** Lee `docs/architecture/overview.md`, los ADRs aplicables y las skills del área (`.ai/skills/`). Si la tarea toca un área con agente definido (`.ai/agents/`), carga su brief.
5. **Implementa en vertical.** Cambio mínimo que cumpla los criterios; tests a la vez, no después.
6. **Verifica.**

   ```bash
   npm run lint && npm run typecheck && npm run test
   cargo test --manifest-path src-tauri/Cargo.toml
   cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
   ```

7. **Cierre.** Ticket a `done`, actualiza el índice. Commit(s) en Conventional Commits con scope. PR con `Closes OG-NNN`.
8. **Memoria.** Si aprendiste algo no obvio (git, plataforma, rendimiento), anótalo en `.ai/memory/`.

Regla de oro: si durante la implementación descubres que el ticket estaba mal definido, se corrige el ticket antes de seguir; no se improvisa alcance.
