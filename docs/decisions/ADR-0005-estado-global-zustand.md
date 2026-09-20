# ADR-0005 · Estado global con Zustand

- **Estado:** aceptado
- **Fecha:** 2026-09-18
- **Decisores:** Raúl López

## Contexto

La UI necesita estado compartido entre vistas: repositorio abierto, refs, status, selección de commit y preferencias de layout. El estado local de React no llega para eso, y un Context + `useReducer` provoca re-renders masivos cuando cambia cualquier parte del árbol.

## Decisión

Usar **Zustand** con stores pequeños por dominio (`ui`, y en el futuro `repo`, `refs`, `staging`) y selectores atómicos en los componentes.

## Alternativas consideradas

- **Redux Toolkit** — robusto y con devtools excelentes, pero mucho boilerplate para un proyecto personal y penaliza la velocidad de iteración.
- **Jotai** — modelo de átomos elegante y buen rendimiento, pero fragmenta el estado en muchos átomos y complica las consultas derivadas sobre el repo.
- **Context + `useReducer`** — sin dependencias, pero cualquier cambio re-renderiza a todos los consumidores, justo lo que hay que evitar en listas de 10 000 commits.

## Consecuencias

- Re-renders selectivos por selector, sin `Provider`: los stores se importan donde hagan falta.
- Test muy simple: `useUiStore.getState()` / `setState()` sin montar componentes.
- Dependencia pequeña (~1 KB) y sin acoplamiento al framework.
- Disciplina necesaria: cada componente selecciona solo lo que usa; suscribirse al store entero anula la ventaja.
- El estado por repositorio se modelará en el ticket OG-002; aquí solo se adopta la librería.
