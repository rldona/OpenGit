# OG-028 · Distribución sin firma

- **Milestone:** M5 — Pulido (decisión de distribución, tras OG-026/OG-027)
- **Estado:** done
- **Depende de:** OG-026
- **Referencias:** ROADMAP.md, README.md

## Contexto

La primera release (`v0.1.0`) se publicó sin firmar. La firma/notarización exige certificados de pago (Apple Developer, Windows) y el proyecto no va a asumir ese coste: los instaladores se distribuyen sin firmar de forma permanente, no como una "fase 2" pendiente.

## Alcance

- Quitar de ROADMAP, README, guía de desarrollo y OG-026 cualquier mención a la firma como deuda pendiente.
- Documentar la decisión y sus consecuencias en el README.
- Añadir instrucciones de instalación para builds sin firmar:
  - macOS: Gatekeeper bloquea el `.dmg`; abrir con clic derecho → Abrir o `xattr -cr /Applications/OpenGit.app`.
  - Windows: SmartScreen avisa del `.exe`/`.msi`; "Más información" → "Ejecutar de todas formas".
  - Linux: `.deb`/`.AppImage` sin cambios.
- Actualizar las notas del release `v0.1.0` con esas instrucciones.

## Criterios de aceptación

- [x] Ninguna doc presenta la firma como trabajo pendiente; la decisión es explícita.
- [x] El README explica cómo instalar los bundles sin firmar en los tres SO.
- [x] El release `v0.1.0` incluye las notas de instalación.
- [x] El updater y el empaquetado `.rpm` quedan como fuera de alcance, no como fase 2.

## Fuera de alcance

- Firmar o notarizar (decisión tomada: no).
- Auto-updater, rpm y canales beta.

## Notas de implementación (2026-09-18)

- ROADMAP (M5 y fuera de alcance), README (Estado + sección Instalación), guía de desarrollo y nota de actualización en OG-026.
- Release `v0.1.0`: notas editadas con las instrucciones de macOS/Windows/Linux.
- Cambio solo de documentación: CI no se dispara (`paths-ignore` incluye `**/*.md` y `docs/**`); el merge del PR es la única puerta.
