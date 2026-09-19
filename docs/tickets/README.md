# Tickets

One file per ticket, named `OG-NNN-slug.md`. Every change in the repository starts from a ticket.

## States

| State | Meaning |
| --- | --- |
| `backlog` | defined but not ready to start (missing decisions or dependencies) |
| `ready` | can be started right away |
| `in-progress` | in development |
| `blocked` | waiting on something external; the reason goes in the ticket |
| `done` | acceptance criteria met |

## Template

```markdown
# OG-NNN · Title

- **Milestone:** M1 — Local MVP
- **Status:** backlog
- **Depends on:** OG-003
- **References:** ADR-0004, docs/architecture/overview.md

## Context
## Scope
## Acceptance criteria
## Out of scope
## Technical notes
```

## Index

| Ticket | Title | Milestone | Status |
| --- | --- | --- | --- |
| [OG-001](OG-001-esqueleto-tauri-react.md) | Tauri 2 + React skeleton | M0 | done |
| [OG-002](OG-002-abrir-repositorio.md) | Open repository and recents | M1 | done |
| [OG-003](OG-003-adaptador-git-rust.md) | Git adapter in Rust: runner and parsers | M1 | done |
| [OG-004](OG-004-vista-log-grafo.md) | Log view with graph | M1 | done |
| [OG-005](OG-005-vista-diff.md) | Diff view with highlighting | M1 | done |
| [OG-006](OG-006-stage-por-hunks.md) | Stage/unstage by hunks and lines | M1 | done |
| [OG-007](OG-007-panel-commit.md) | Commit panel | M1 | done |
| [OG-008](OG-008-sidebar-refs-checkout.md) | Branches/tags sidebar and checkout | M1 | done |
| [OG-009](OG-009-working-tree-status.md) | Working tree status | M1 | done |
| [OG-010](OG-010-watcher-repo.md) | `.git` watcher and refresh | M1 | done |
| [OG-011](OG-011-remotos-fetch-pull-push.md) | Fetch, pull and push | M2 | done |
| [OG-012](OG-012-ci-build-a-demanda.md) | CI: separate PR validation and on-demand multi-platform build | M0 | done |
| [OG-013](OG-013-scroll-grafo.md) | Smooth graph scrolling (no flicker) | M1 | done |
| [OG-014](OG-014-ui-en-ingles.md) | UI in English (pre-i18n) | M1 | done |
| [OG-015](OG-015-tags.md) | Tag management | M3 | done |
| [OG-016](OG-016-stash.md) | Stash | M3 | done |
| [OG-017](OG-017-cherry-pick-revert-reset.md) | Cherry-pick, revert and soft reset | M3 | done |
| [OG-018](OG-018-busqueda-commits.md) | Commit search | M3 | done |
| [OG-019](OG-019-estado-operaciones.md) | Operation state and Abort/Continue | M4 | done |
| [OG-020](OG-020-editor-conflictos.md) | Block-based conflict editor | M4 | done |
| [OG-021](OG-021-rebase-interactivo.md) | Visual interactive rebase | M4 | done |
| [OG-022](OG-022-temas.md) | Light/dark theme | M5 | done |
| [OG-023](OG-023-atajos-teclado.md) | Keyboard shortcuts | M5 | done |
| [OG-024](OG-024-submodulos-worktrees.md) | Submodules and worktrees in read-only mode | M5 | done |
| [OG-025](OG-025-lfs.md) | Git LFS: detection and warnings | M5 | done |
| [OG-026](OG-026-releases.md) | Packaging and releases (phase 1: unsigned) | M5 | done |
| [OG-027](OG-027-release-artefactos.md) | Fix the release artifact upload | M5 | done |
| [OG-028](OG-028-sin-firma.md) | Distribution without signing | M5 | done |
| [OG-029](OG-029-reword-multiple.md) | Multiple reword in interactive rebase (v2) | M5 | done |
| [OG-030](OG-030-diff-stash.md) | Stash diff | M5 | done |
| [OG-031](OG-031-descartar-hunks.md) | Discard hunks and lines (per-hunk inversion) | M5 | done |
| [OG-032](OG-032-arbol-ficheros.md) | File tree in diff and status | M5 | done |
| [OG-033](OG-033-skip.md) | `--skip` in rebase and cherry-pick | M5 | done |
| [OG-034](OG-034-url-remoto.md) | Open the remote URL | M5 | done |
| [OG-035](OG-035-chrome.md) | Window chrome | M6 | done |
| [OG-036](OG-036-splits.md) | Resizable splits | M6 | done |
| [OG-037](OG-037-tabla-commits.md) | Commit table with header | M6 | done |
| [OG-038](OG-038-context-menus.md) | Context menus | M6 | done |
| [OG-039](OG-039-paneles-diff.md) | SourceTree-style status/diff panels | M6 | done |
| [OG-040](OG-040-incoming-outgoing.md) | Incoming/outgoing commits with badges | M6 | done |
| [OG-041](OG-041-barra-superior.md) | Window top bar | M7 | done |
| [OG-042](OG-042-sidebar-colapsable.md) | SourceTree-style sidebar | M7 | done |
| [OG-043](OG-043-vista-commit.md) | Dedicated commit view | M7 | done |
| [OG-044](OG-044-layout-3-zonas.md) | 3-zone layout in history | M7 | done |
| [OG-045](OG-045-columnas-ordenables.md) | Sortable columns in the commit table | M7 | done |
| [OG-046](OG-046-detalle-stash.md) | Stash detail as a view | M7 | done |
| [OG-047](OG-047-ancho-grafo.md) | Graph width by visible range | M7 | done |
| [OG-048](OG-048-identidad-visual.md) | Visual identity (badges, icons, dates) | M7 | done |
| [OG-049](OG-049-merge.md) | Branch merge | M7 | done |
| [OG-050](OG-050-pull-modal.md) | Pull with dialog and progress window | M7 | done |
| [OG-051](OG-051-tags-y-tabla.md) | Clickable tags and table borders | M7 | done |
| [OG-052](OG-052-busqueda-commits-v2.md) | Commit search (v2) | M8 | ready |
| [OG-053](OG-053-historial-fichero.md) | File history | M8 | ready |
| [OG-054](OG-054-comparar-refs.md) | Compare commits and branches | M8 | ready |
| [OG-055](OG-055-blame.md) | Per-line blame | M8 | ready |
| [OG-056](OG-056-gestion-remotos.md) | Remote management | M8 | ready |
| [OG-057](OG-057-gestion-submodulos.md) | Submodule management | M8 | ready |
| [OG-058](OG-058-worktrees.md) | Manageable worktrees | M8 | ready |
| [OG-059](OG-059-merge-estrategias.md) | Merge strategies and Merge in the native menu | M8 | ready |
| [OG-060](OG-060-drag-and-drop.md) | Drag & drop for merge and staging | M8 | ready |
| [OG-061](OG-061-image-preview.md) | Image preview and comparison | M8 | done |
| [OG-062](OG-062-english-translation.md) | Translate the project to English | M8 | done |
| [OG-065](OG-065-refresh-button.md) | Refresh button: stashes and feedback | M8 | ready |
