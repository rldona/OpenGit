# OG-026 · Empaquetado y releases (fase 1: sin firma)

- **Milestone:** M5 — Pulido
- **Estado:** done
- **Depende de:** OG-012
- **Referencias:** ROADMAP.md

## Contexto

`build.yml` genera binarios de desarrollo a demanda (`--no-bundle`), pero no hay forma de publicar un release con instaladores. La firma y la notarización exigen certificados (Apple Developer, Windows) que todavía no existen.

## Alcance (fase 1)

- Workflow `release.yml` que se dispara al empujar un tag `v*` (y a mano con `workflow_dispatch` + tag).
- Bundles por SO:
  - macOS: `.dmg`
  - Linux: `.deb` y `.AppImage`
  - Windows: `.msi` y `.exe` (NSIS)
- Comprobación de que el tag coincide con la versión de `package.json` y `tauri.conf.json`; si no, el workflow falla antes de compilar.
- Release en GitHub **en borrador**, con notas generadas y todos los artefactos adjuntos; el mantenedor revisa y publica.
- Re-ejecuciones: si el borrador ya existe, se suben los artefactos con `--clobber` en vez de fallar.
- Documentación del flujo en `docs/guides/development.md`.

## Criterios de aceptación

- [x] El workflow solo compila bundles en tags (`v*`) o dispatch manual; no se ejecuta en cada push.
- [x] Un tag con versión distinta a `package.json`/`tauri.conf.json` falla con un mensaje claro.
- [x] El workflow define el adjuntado por SO (dmg validado en local; deb/AppImage/msi/exe pendientes del primer tag).
- [x] El bundle local sin firmar genera la ruta que espera el workflow (`bundle/dmg/*.dmg`); la ejecución real se validará en el primer tag.
- [x] Sin firma ni notarización: documentado como fase 2 (certificados Apple/Windows, universal binary, updater y rpm).

## Fuera de alcance

- Firma/notarización de macOS y Windows, y binario universal (arm64 + x64).
- Auto-updater y canales beta.
- Empaquetado `.rpm` (fase 2) y publicación automática sin revisión.

## Notas técnicas

- El trabajo se divide en un job `build` (matriz de 3 SO, sube artefactos) y un job `release` (Ubuntu, descarga todo y crea el borrador una sola vez para evitar carreras).
- Los minutos de macOS facturan 10×: por eso los bundles solo se construyen en tags, nunca por push.
- `--bundles` explícito por plataforma para que el resultado sea determinista (`dmg`; `deb,appimage`; `msi,nsis`).
- `CI=true` en el entorno evita intentos de firma con el llavero del runner.
- La versión de la app vive duplicada en `package.json`, `tauri.conf.json` y `Cargo.toml`; el workflow valida las dos primeras y la tercera queda como deuda (sincronización automática en fase 2).

## Notas de implementación (2026-09-18)

- `.github/workflows/release.yml`: jobs `build` (matriz 3 SO, `--bundles` por plataforma, artefactos) y `release` (descarga todo y crea el borrador una vez, con `--clobber` si ya existe).
- El check de versión se probó localmente con `TAG=v0.1.0` (ok) y `TAG=v9.9.9` (falla con mensaje).
- Bundle macOS validado sin firma (`CI=true npm run tauri build -- --bundles dmg`): dmg aarch64 en `bundle/dmg/`. Los flags de Linux/Windows se comprobaron contra `tauri build --help` (valores válidos por host).
- Pendiente de validar en el primer tag real: `.deb`, `.AppImage`, `.msi`, `.exe` y creación del borrador.
- Cerrado el 2026-09-18 con CI verde (Frontend 36 s, Rust 1m43s) en el PR #22. Con esto queda completo M5 salvo la validación del primer release.
