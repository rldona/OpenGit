# ADR-0005 · Global state with Zustand

- **Status:** accepted
- **Date:** 2026-09-18
- **Deciders:** Raúl López

## Context

The UI needs state shared across views: open repository, refs, status, commit
selection and layout preferences. React local state is not enough for that, and
a Context + `useReducer` causes massive re-renders when any part of the tree
changes.

## Decision

Use **Zustand** with small per-domain stores (`ui`, and later `repo`, `refs`,
`staging`) and atomic selectors in the components.

## Alternatives considered

- **Redux Toolkit** — robust and with excellent devtools, but a lot of
  boilerplate for a personal project and it hurts iteration speed.
- **Jotai** — elegant atom model and good performance, but it fragments state
  into many atoms and complicates derived queries over the repository.
- **Context + `useReducer`** — no dependencies, but any change re-renders every
  consumer, exactly what must be avoided in 10,000-commit lists.

## Consequences

- Selective re-renders per selector, no `Provider`: stores are imported wherever
  they are needed.
- Very simple testing: `useUiStore.getState()` / `setState()` without mounting
  components.
- Small dependency (~1 KB) and no coupling to the framework.
- Discipline required: each component selects only what it uses; subscribing to
  the whole store cancels the advantage.
- Per-repository state will be modelled in ticket OG-002; here only the library
  is adopted.
