# OG-014 · UI en inglés (pre-i18n)

- **Milestone:** M1 — MVP local
- **Estado:** in-progress
- **Depende de:** —
- **Referencias:** AGENTS.md

## Contexto

La app nació con los textos de UI en español. La convención del proyecto es código e identificadores en inglés; la UI también lo estará, y más adelante se decidirá si se añade multidioma (español incluido).

## Alcance

- Traducir al inglés todos los textos visibles: componentes, stores, mensajes de error del bridge y del núcleo Rust, títulos de diálogos nativos y el `lang` del HTML.
- Mantener documentación, tickets, ADRs y memoria en español.
- Actualizar los tests que comprueban textos.

## Criterios de aceptación

- [ ] No queda ningún texto de UI en español (fuera de `docs/`, `.ai/` y comentarios).
- [ ] Tests de frontend y Rust en verde con las nuevas cadenas.
- [ ] Lint, typecheck, build y `tauri build` en verde.

## Fuera de alcance

- Infraestructura de i18n (ficheros de traducción, selector de idioma): se decidirá más adelante.

## Notas de implementación (2026-09-18)

- Se tradujeron componentes (`App`, `HistoryView`, `StatusView`, `CommitPanel`, `DiffView`, `PatchView`), stores (`repo`, `status`, `commit`), mensajes de `formatGitError`, diálogos nativos y los mensajes de error del núcleo Rust.
- `AGENTS.md` fija la regla: UI en inglés, documentación en español.
- Pendiente para cerrar: PR y CI verde (va en el PR de OG-008).
