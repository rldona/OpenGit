# OG-027 · Arreglar la subida de artefactos del release

- **Milestone:** M5 — Pulido (seguimiento de OG-026)
- **Estado:** done
- **Depende de:** OG-026
- **Referencias:** ROADMAP.md

## Contexto

El primer tag `v0.1.0` construyó los tres bundles correctamente, pero el job `release` falló: `artifacts/*/*` expande también directorios (`deb/`, `appimage/`, `msi/`, `nsis/`), y `gh release upload` / `gh release create` no aceptan directorios. El borrador de `v0.1.0` quedó solo con el `.dmg`.

## Alcance

- Pasar a `gh` una lista explícita de ficheros (`find artifacts -type f`) en los dos caminos: crear el borrador y re-subir con `--clobber`.
- Completar el borrador `v0.1.0` con los artefactos reales del run fallido usando el comando corregido, sin recompilar los bundles.
- Documentar que el workflow corregido se validará en el próximo tag (no se relanza la matriz de 3 SO solo para probar el job de release).

## Criterios de aceptación

- [x] Los argumentos de `gh` son solo ficheros, nunca directorios.
- [x] El borrador `v0.1.0` contiene dmg, deb, AppImage, msi y exe.
- [x] Sin recompilar: se reutilizan los artefactos del run `35352127966`.

## Fuera de alcance

- Firma/notarización (fase 2 de OG-026).
- Relanzar los bundles de macOS/Windows solo para validar el job corregido.

## Notas de implementación (2026-09-18)

- Causa: `upload-artifact` conserva subcarpetas (`deb/`, `appimage/`, `msi/`, `nsis/`), así que `artifacts/*/*` expandía directorios en el runner.
- Fix: lista explícita con `find -type f -print0` y array de bash (compatible con bash 3.2), usado en los dos caminos (crear y re-subir).
- Verificación real sin recompilar: `gh run download 35352127966` y el mismo bucle contra el borrador existente; quedan los 5 artefactos. El workflow corregido se validará end-to-end en el próximo tag.
- Cerrado el 2026-09-18 con CI verde (Frontend 36 s, Rust 1m20s) en el PR #23.
