# ADR-0006 · Editor de diff basado en CodeMirror 6

- **Estado:** aceptado
- **Fecha:** 2026-09-18
- **Decisores:** Raúl López

## Contexto

La vista de diff necesita: modo unificado y lado a lado, resaltado de sintaxis por lenguaje, números de línea, desplazamiento fluido con ficheros de miles de líneas y control total del tema (CSS propio). Todo debe funcionar offline dentro de la webview, sin servicios externos.

## Decisión

Usar **CodeMirror 6** (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/merge` y `@codemirror/language-data`) como capa de presentación. **Git sigue siendo la fuente de verdad**: el contenido del diff es el parche que devuelve `git diff`; CodeMirror no calcula el diff, solo lo pinta.

## Alternativas consideradas

- **Monaco** — más pesado (varios MB), pensado para edición tipo VS Code; su theming es más rígido y no aporta nada extra para un visor de solo lectura.
- **Renderizador propio con resaltado (Shiki/Prism)** — habría que reimplementar virtualización, plegado y alineación; mucho más código para peor resultado.
- **Diff calculado en el frontend (p. ej. `diff` de jsdiff)** — duplicaría la lógica de git y podría divergir de lo que se va a stagear (OG-006). Descartado por ADR-0003.

## Consecuencias

- El bundle crece (CodeMirror 6 ~400 KB entre todos los paquetes) pero los lenguajes se cargan bajo demanda con `@codemirror/language-data`; es aceptable en una app de escritorio.
- La alineación visual del modo lado a lado la calcula CodeMirror sobre los dos documentos derivados del parche: puede diferir cosméticamente del agrupado en hunks de git; el contenido (y lo que se stagea) sigue siendo el de git.
- El modo unificado muestra el parche de git tal cual, con decoraciones de color por línea (`+`/`-`), sin reinterpretarlo.
- Cambiar de editor más adelante tendría coste alto: requeriría otro ADR que sustituya a este.
