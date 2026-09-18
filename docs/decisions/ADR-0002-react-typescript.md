# ADR-0002 · Frontend en React + TypeScript

- **Estado:** aceptado
- **Fecha:** 2026-09-18
- **Decisores:** Raúl López

## Contexto

La UI concentra el valor del producto: grafo de commits, diff, staging, sidebar y panel de salida. Necesita librerías maduras de diff, virtualización de listas largas y componentes accesibles.

## Decisión

**React + TypeScript** con Vite sobre Tauri 2.

## Alternativas consideradas

- **Svelte 5** — menos peso en runtime y runes muy cómodos para listas grandes, pero ecosistema más pequeño justo en las piezas críticas (visores de diff, virtualización, Testing Library).
- **SolidJS** — rendimiento excelente, pero comunidad y ecosistema menores; más riesgo de escribir componentes propios.

## Consecuencias

- Acceso directo a CodeMirror 6 / Monaco, TanStack Virtual, Testing Library y patrones conocidos de testing de componentes.
- Mayor peso y boilerplate que alternativas; se mitiga con Vite y virtualización agresiva de listas.
- El rendimiento en repos grandes depende de decisiones concretas (memorización, filas virtualizadas, grafo en canvas), no del framework.
- Gestión de estado global pendiente de decidir en el ticket OG-001 (propuesta: Zustand); si se adopta, será un ADR nuevo.
