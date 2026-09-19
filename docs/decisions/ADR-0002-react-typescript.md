# ADR-0002 · React + TypeScript frontend

- **Status:** accepted
- **Date:** 2026-09-18
- **Deciders:** Raúl López

## Context

The UI concentrates the product's value: commit graph, diff, staging, sidebar
and output panel. It needs mature diff libraries, long-list virtualization and
accessible components.

## Decision

**React + TypeScript** with Vite on top of Tauri 2.

## Alternatives considered

- **Svelte 5** — less runtime weight and very comfortable runes for long lists,
  but a smaller ecosystem exactly in the critical pieces (diff viewers,
  virtualization, Testing Library).
- **SolidJS** — excellent performance, but a smaller community and ecosystem;
  more risk of writing components from scratch.

## Consequences

- Direct access to CodeMirror 6 / Monaco, TanStack Virtual, Testing Library and
  well-known component testing patterns.
- More weight and boilerplate than the alternatives; mitigated with Vite and
  aggressive list virtualization.
- Performance in large repositories depends on concrete decisions (memoization,
  virtualized rows, canvas graph), not on the framework.
- Global state management still to be decided in ticket OG-001 (proposal:
  Zustand); if adopted, it will be a new ADR.
