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
| [OG-002](OG-002-abrir-repositorio.md) | Abrir repositorio y recientes | M1 | backlog |
| [OG-003](OG-003-adaptador-git-rust.md) | Adaptador git en Rust: runner y parsers | M1 | backlog |
| [OG-004](OG-004-vista-log-grafo.md) | Vista de log con grafo | M1 | backlog |
| [OG-005](OG-005-vista-diff.md) | Vista de diff con resaltado | M1 | backlog |
| [OG-006](OG-006-stage-por-hunks.md) | Stage/unstage por hunks y líneas | M1 | backlog |
| [OG-007](OG-007-panel-commit.md) | Panel de commit | M1 | backlog |
| [OG-008](OG-008-sidebar-refs-checkout.md) | Sidebar de branches/tags y checkout | M1 | backlog |
| [OG-009](OG-009-working-tree-status.md) | Working tree status | M1 | backlog |
| [OG-010](OG-010-watcher-repo.md) | Watcher de `.git` y refresco | M1 | backlog |
| [OG-011](OG-011-remotos-fetch-pull-push.md) | Fetch, pull y push | M2 | backlog |
