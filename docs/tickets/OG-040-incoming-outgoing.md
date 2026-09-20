# OG-040 · Commits entrantes/salientes con badges

- **Milestone:** M6 — Paridad visual con SourceTree
- **Estado:** in-progress
- **Depende de:** OG-008, OG-037
- **Referencias:** ROADMAP.md

## Contexto

El tracking solo se muestra junto a la rama actual (↑/↓ globales) y el grafo no distingue los commits que están por llegar del upstream o los pendientes de subir. SourceTree marca cada rama con sus contadores y pinta los commits entrantes de forma distinta.

## Alcance

- **Badges por rama**: el sidebar usa el campo `track` de `for-each-ref` (`[ahead N, behind M]`) para mostrar `↑n`/`↓m` en cualquier rama con upstream, no solo en la actual. Parser puro `parseTrack`.
- **Commits entrantes/salientes**:
  - Rust: `tracking_commits(path, upstream)` devuelve los hashes de `HEAD..upstream` (incoming) y `upstream..HEAD` (outgoing), limitados a 200 por lado y con validación de la ref.
  - Store de refs: `incoming`/`outgoing` se cargan y refrescan junto a `branchTracking` cuando hay upstream.
  - Historial: cada fila con hash en `incoming`/`outgoing` muestra un badge `↓`/`↑` y una marca de color (los entrantes en acento), sin tocar la virtualización.

## Criterios de aceptación

- [x] Cualquier rama con upstream muestra sus contadores ↑/↓ en el sidebar.
- [x] `tracking_commits` valida la ref y devuelve los hashes correctos de incoming/outgoing.
- [x] Las filas del historial marcan los commits entrantes y salientes con badge y clase.
- [x] Sin upstream, las listas quedan vacías y no hay llamada extra a git.
- [x] Tests: parser de track, integración de `tracking_commits`, store, sidebar e historial.

## Fuera de alcance

- Fetch automático al abrir el repo o al refrescar (los conjuntos se calculan contra las refs locales).
- Contadores por remoto o por rama remota individual (solo la upstream de cada local).
- Reescribir el grafo para colorear lanes enteras de incoming.

## Notas técnicas

- `parseTrack` acepta `[ahead 1, behind 2]`, `[ahead 1]`, `[behind 2]`, `[gone]` y vacío (devuelve `null` para los dos últimos).
- `tracking_commits` usa `git rev-list --max-count=200 --end-of-options` con el rango y rechaza refs con espacios, `..` o guion inicial.
- Los conjuntos viven en el store de refs para que el sidebar y el historial compartan la misma foto.

## Notas de implementación (2026-09-18)

- Rust: `TrackingCommits` y `tracking_commits` con `rev-list --max-count=200 --end-of-options`; rechaza refs con espacios, `..` o guion inicial. Test de integración con commit remoto que sale de la base (si descendiera del local, ambos conjuntos quedarían vacíos).
- Frontend: `parseTrack` para `[ahead N, behind M]` (también `[gone]`/vacío → null); el sidebar pinta ↑/↓ en cualquier rama con upstream usando el campo `track` de `for-each-ref`; el store de refs carga incoming/outgoing solo si hay upstream (una llamada extra por refresco).
- Historial: badge ↓/↑ y clase `incoming`/`outgoing` por fila; los entrantes tiñen el asunto con el acento.
- Tests: 232 frontend (2 de parseTrack, 2 de store, aserciones en sidebar y App) y 121 Rust (1 de integración).
- Pendiente para cerrar: PR y CI verde.
