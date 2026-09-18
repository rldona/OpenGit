# Tickets

Un fichero por ticket, nombrado `OG-NNN-slug.md`. Todo cambio del repositorio nace de un ticket.

## Estados

| Estado | Significado |
| --- | --- |
| `backlog` | definido pero no listo para empezar (faltan decisiones o dependencias) |
| `ready` | se puede empezar ya |
| `in-progress` | en desarrollo |
| `blocked` | espera algo externo; el motivo va en el ticket |
| `done` | criterios de aceptación cumplidos |

## Plantilla

```markdown
# OG-NNN · Título

- **Milestone:** M1 — MVP local
- **Estado:** backlog
- **Depende de:** OG-003
- **Referencias:** ADR-0004, docs/architecture/overview.md

## Contexto
## Alcance
## Criterios de aceptación
## Fuera de alcance
## Notas técnicas
```

## Índice

| Ticket | Título | Milestone | Estado |
| --- | --- | --- | --- |
| [OG-001](OG-001-esqueleto-tauri-react.md) | Esqueleto Tauri 2 + React | M0 | done |
| [OG-002](OG-002-abrir-repositorio.md) | Abrir repositorio y recientes | M1 | done |
| [OG-003](OG-003-adaptador-git-rust.md) | Adaptador git en Rust: runner y parsers | M1 | done |
| [OG-004](OG-004-vista-log-grafo.md) | Vista de log con grafo | M1 | done |
| [OG-005](OG-005-vista-diff.md) | Vista de diff con resaltado | M1 | done |
| [OG-006](OG-006-stage-por-hunks.md) | Stage/unstage por hunks y líneas | M1 | done |
| [OG-007](OG-007-panel-commit.md) | Panel de commit | M1 | done |
| [OG-008](OG-008-sidebar-refs-checkout.md) | Sidebar de branches/tags y checkout | M1 | done |
| [OG-009](OG-009-working-tree-status.md) | Working tree status | M1 | done |
| [OG-010](OG-010-watcher-repo.md) | Watcher de `.git` y refresco | M1 | done |
| [OG-011](OG-011-remotos-fetch-pull-push.md) | Fetch, pull y push | M2 | done |
| [OG-012](OG-012-ci-build-a-demanda.md) | CI: build multiplataforma a demanda | M0 | done |
| [OG-013](OG-013-scroll-grafo.md) | Scroll fluido del grafo (sin parpadeo) | M1 | done |
| [OG-014](OG-014-ui-en-ingles.md) | UI en inglés (pre-i18n) | M1 | done |
| [OG-015](OG-015-tags.md) | Gestión de tags | M3 | done |
| [OG-016](OG-016-stash.md) | Stash | M3 | done |
| [OG-017](OG-017-cherry-pick-revert-reset.md) | Cherry-pick, revert y reset suave | M3 | done |
| [OG-018](OG-018-busqueda-commits.md) | Búsqueda de commits | M3 | done |
| [OG-019](OG-019-estado-operaciones.md) | Estado de operaciones y Abort/Continue | M4 | done |
| [OG-020](OG-020-editor-conflictos.md) | Editor de conflictos por bloques | M4 | done |
| [OG-021](OG-021-rebase-interactivo.md) | Rebase interactivo visual | M4 | done |
| [OG-022](OG-022-temas.md) | Tema claro/oscuro | M5 | done |
| [OG-023](OG-023-atajos-teclado.md) | Atajos de teclado | M5 | done |
| [OG-024](OG-024-submodulos-worktrees.md) | Submódulos y worktrees en lectura | M5 | done |
| [OG-025](OG-025-lfs.md) | Git LFS: detección y avisos | M5 | done |
| [OG-026](OG-026-releases.md) | Empaquetado y releases (fase 1) | M5 | done |
| [OG-027](OG-027-release-artefactos.md) | Arreglar subida de artefactos del release | M5 | done |
| [OG-028](OG-028-sin-firma.md) | Distribución sin firma | M5 | done |
| [OG-029](OG-029-reword-multiple.md) | Reword múltiple en rebase (v2) | M5 | done |
| [OG-030](OG-030-diff-stash.md) | Diff de stash | M5 | done |
| [OG-031](OG-031-descartar-hunks.md) | Descartar hunks y líneas | M5 | done |
| [OG-032](OG-032-arbol-ficheros.md) | Árbol de ficheros en diff y status | M5 | done |
| [OG-033](OG-033-skip.md) | `--skip` en rebase y cherry-pick | M5 | in-progress |
