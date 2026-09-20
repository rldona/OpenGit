# OG-012 · CI: separar validación de PR y build multiplataforma a demanda

- **Milestone:** M0 — Fundación
- **Estado:** in-progress
- **Depende de:** OG-001
- **Referencias:** .github/workflows/ci.yml, .github/workflows/build.yml

## Contexto

Cada push al PR lanzaba builds en macOS, Windows y Linux (~8 min de reloj, con macOS facturando a 10×). Para cambios de UI, docs o tests, esperar los tres artefactos es desproporcionado.

## Alcance

- `ci.yml` (desarrollo, en cada PR y push a `main`): solo frontend + Rust en Ubuntu. Sin matriz.
- `paths-ignore` para que los cambios que solo tocan documentación no lancen CI.
- `build.yml` (a demanda, `workflow_dispatch`): matriz macOS/Windows/Linux con `--no-bundle` y subida de artefactos.
- Documentar cómo lanzarlo.

## Criterios de aceptación

- [x] Un PR de código da señal en ~3 min (frontend + Rust). _(Frontend 15 s, Rust 3m21s)_
- [x] Un PR solo de docs no lanza CI. _(verificado con el commit de cierre de este ticket, que no disparó run)_
- [ ] `build.yml` se lanza a demanda y sube el binario de cada SO como artefacto.
- [x] Guía de desarrollo actualizada.

## Fuera de alcance

- Firma de artefactos e instaladores completos (M5).
- Releases automáticas en tags y changelog (M5).

## Notas técnicas

- `actions/upload-artifact@v7` (node24), un artefacto por SO: `opengit-macos`, `opengit-linux`, `opengit-windows`.
- El build usa el perfil release de Cargo (lto, strip), así que valida el binario real, no solo `cargo check`.
- Si algún día se activan required checks, revisar el `paths-ignore`: un workflow que no se dispara deja el check en espera.
