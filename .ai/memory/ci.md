# CI

## macOS factura 10× en GitHub Actions

- **Fecha:** 2026-09-18
- **Contexto:** OG-001 lanzaba frontend + Rust + build en macOS, Ubuntu y Windows en cada push al PR (~8–9 min de reloj).
- **Hallazgo:** GitHub Actions factura macOS a 10× y Windows a 2× sobre los minutos de Linux. Las builds de los tres SO eran el cuello de botella, no la validación en sí (frontend 15 s, Rust 2m44s).
- **Implicación:** OG-012 separó los workflows: `ci.yml` (frontend + Rust, solo Ubuntu) en cada PR y `build.yml` (`workflow_dispatch`, matriz de 3 SO, `--no-bundle`, artefactos) a demanda. Revisar si cambia la política de facturación.

## paths-ignore y required checks

- **Fecha:** 2026-09-18
- **Contexto:** filtrado de commits que solo tocan docs en `ci.yml`.
- **Hallazgo:** con `paths-ignore`, un cambio solo de docs no dispara el workflow; si hubiera required checks configurados, el merge se quedaría esperando un check que nunca llega.
- **Implicación:** ahora no hay branch protection, así que es seguro. Si se activa, quitar el filtro o sustituirlo por un job ligero de detección de cambios.
