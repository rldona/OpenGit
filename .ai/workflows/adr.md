# Workflow: ADR

## Cuándo hace falta

- Elegir o cambiar una dependencia estructural (shell, motor git, editor de diff, estado global).
- Definir un protocolo o modelo de datos que la UI y Rust comparten.
- Cualquier decisión donde volver atrás implique reescribir componentes.

No hace falta ADR para decisiones locales y baratas de revertir.

## Pasos

1. Copia `docs/decisions/TEMPLATE.md` a `ADR-NNNN-slug.md` con el siguiente número libre.
2. Rellena contexto, decisión, alternativas y consecuencias. Las consecuencias negativas también se escriben.
3. Estado inicial `propuesto`; discusión en el ticket o PR.
4. Al aceptarse, actualiza el estado y añade la fila al índice `docs/decisions/README.md`.
5. Si sustituye a otro ADR: el antiguo pasa a `sustituido por ADR-NNNN` (no se edita su contenido) y se enlazan.
6. Enlaza el ADR desde `AGENTS.md` si afecta al trabajo diario (stack, comandos) y desde el ticket que lo motivó.
