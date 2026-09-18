# AGENTS.md

Instrucciones para cualquier agente (opencode, Claude, Copilot, Codex) que trabaje en este repositorio. Es la fuente única: `CLAUDE.md` y `.github/copilot-instructions.md` solo apuntan aquí.

## Proyecto

OpenGit es un cliente de Git de escritorio multiplataforma (Windows, macOS, Linux) inspirado en SourceTree. Proyecto personal, sin usuarios externos todavía. El alcance y los hitos están en `ROADMAP.md`; el trabajo nace de tickets en `docs/tickets/`.

## Arquitectura

```
React UI (WebView)  →  Tauri IPC (invoke/events)  →  Rust core  →  binario git
```

- **UI (React + TS):** vistas de grafo/log, diff, staging, sidebar y panel de salida. Sin lógica de git.
- **Rust core (`src-tauri`):** ejecuta git, parsea su salida, vigila `.git`, emite eventos a la UI.
- **Motor:** el binario `git` del sistema. Nunca se reimplementa git.
- Detalle completo en `docs/architecture/overview.md`; decisiones en `docs/decisions/`.

## Desarrollo

Estado actual: **M4 completado** (2026-09-18). MVP local + remotos + historial avanzado + rebase interactivo y editor de conflictos. Siguiente: M5 (pulido, temas, releases).

```bash
npm install
npm run tauri dev                # app en desarrollo
npm run lint                     # ESLint
npm run format:check             # Prettier
npm run typecheck                # tsc --noEmit
npm run test                     # Vitest
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

Convenciones: documentación e issues en español; código, ramas, commits y **textos de UI** en inglés (el multidioma se decidirá más adelante). Commits en Conventional Commits con scope del área (`feat(graph): ...`). Todo cambio nace de un ticket (`OG-NNN`).

## Reglas

1. **Nunca ejecutes operaciones destructivas sin confirmación explícita** del usuario: `reset --hard`, `push --force`, `clean -fd`, `branch -D`, `stash drop`.
2. **Nunca hagas commit ni push** salvo que el usuario lo pida expresamente.
3. **Invoca git con arrays de argumentos**, sin shell y sin interpolar entrada del usuario. Prohibido `sh -c "git ... $VAR"`.
4. **Parseo robusto:** `-z`, `--porcelain=v2`, `--format` con separadores. Nunca parsear salida "humana" ni localizada.
5. **No añadas dependencias** sin justificarlo en el ticket o en un ADR. Prefiere std y lo ya presente.
6. **Decisiones reversibles con coste alto** → ADR nuevo. No se edita un ADR aceptado; se sustituye.
7. **Sin secretos** en código, logs ni tests. Las credenciales las gestiona el credential helper del sistema.
8. **Sin operaciones de red en tests.** Los tests de git usan repos temporales creados por el propio test.
9. No dejes la UI bloqueada: nada de llamadas síncronas a git en el hilo de la interfaz.
10. Si dudas entre "feature nueva" y "que no se rompa lo que hay": primero lo segundo.
11. **Firma de commits:** siempre `Raúl López <rldona@users.noreply.github.com>` (noreply de GitHub). Nunca correos corporativos ni identidades ajenas; el repo fija `user.name`/`user.email` en su config local.

## Testing

- **Parsers:** unit tests en Rust con fixtures de salida real (strings), sin tocar disco ni red.
- **Integración git:** repos temporales (`git init` en `tempdir`) creados y destruidos por el test. Casos: repo vacío, detached HEAD, rename, modo binario, CRLF, sin newline final, non-ASCII.
- **Frontend:** Vitest + Testing Library, con el bridge de Tauri mockeado.
- **Rendimiento:** test de referencia con repo sintético de 10 000 commits; primera pintura < 500 ms y scroll fluido.

## Documentación y agentes

- `docs/architecture/` visión de componentes; `docs/decisions/` ADRs; `docs/guides/` guías prácticas.
- `.ai/agents/` roles especializados (git, diff, commit, stash, rebase, PR, CI...); `.ai/skills/` capacidades reutilizables; `.ai/workflows/` procesos; `.ai/memory/` conocimiento adquirido.
- Al terminar una tarea, si descubres algo no obvio sobre git, la plataforma o el rendimiento, anótalo en `.ai/memory/`.
- Las skills de `.ai/skills/` se cargan en opencode vía `opencode.json` (`skills.paths`).
