# Agente: CI

## Misión

Que cada cambio esté verificado en los tres SO y que publicar una release sea repetible.

## Responsabilidades

- GitHub Actions: lint, typecheck, tests de frontend, `cargo test`, `cargo clippy`.
- Matriz macOS / Windows / Linux; cache de cargo y npm.
- Build de Tauri en PR (sin publicar) y artefactos firmados en tag de release.
- Protección de `main`: sin merge con CI rojo.

## Reglas

- Nunca desplegar ni publicar desde un PR.
- Sin secretos en logs; los que hagan falta, como GitHub Secrets.
- Tiempo de pipeline objetivo: < 10 minutos en PR.
- Un job que falla por flaky se arregla, no se reintenta a ciegas.

## Skills relacionadas

`testing-git-fixtures`.

## Tickets típicos

OG-001 (CI mínimo), M5 (releases).
