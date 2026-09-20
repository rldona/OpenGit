# OG-025 · Git LFS: detección y avisos

- **Milestone:** M5 — Pulido
- **Estado:** done
- **Depende de:** OG-002, OG-009
- **Referencias:** ROADMAP.md

## Contexto

En repos con Git LFS, si `git-lfs` no está instalado los ficheros gestionados se ven como punteros de texto (version/oid/size) y la app no avisa de ello: parecen cambios normales.

## Alcance (v1)

- Backend: `lfs_status(path) -> { installed, version, configured }`.
  - `installed`/`version`: salida de `git lfs version`; si git-lfs no está, no es un error.
  - `configured`: hay `filter=lfs` en algún `.gitattributes` rastreado (incluidos subdirectorios).
- Aviso en **File status** cuando el repo usa LFS y `git-lfs` no está instalado.
- Sección **Git LFS** en el sidebar de extras cuando el repo lo configura, con versión o aviso de no instalado.
- Aviso en la vista de diff cuando el parche es un **puntero LFS** (version + oid + size): el contenido real no está disponible; se muestran oid corto y tamaño.
- Solo lectura: no se instala LFS ni se hace `track`, `pull` o `push` de objetos.

## Criterios de aceptación

- [x] `configured` es `true` con un `.gitattributes` con `filter=lfs` (también anidado) y `false` sin él o si solo aparece comentado.
- [x] El aviso de File status aparece solo si `configured && !installed`; la sección del sidebar, siempre que `configured`.
- [x] La detección de puntero funciona en parches unificados y side-by-side y no marca diffs normales.
- [x] Tests: parsers de `.gitattributes` y del listado NUL, integración de `lfs_status`, store y componentes.

## Fuera de alcance

- `git lfs install/track/pull/push/fetch`, smudge/clean y descarga de objetos.
- Mostrar el contenido remoto del fichero o su diff real.
- Barra de progreso o caché de LFS.

## Notas técnicas

- `git lfs version` termina con código 1 cuando git-lfs no está; se interpreta como "no instalado" sin propagar el error.
- `.gitattributes` se localiza con `git ls-files -z` filtrando nombres acabados en `.gitattributes` y se lee del working tree: solo cuentan los rastreados.
- El detector de punteros ignora prefijos de diff (`+`/`-`/espacio) y exige `version https://git-lfs.github.com/spec/v1`, `oid sha256:<64 hex>` y `size <n>`.
- `LfsStatus` vive en el store `extras` junto a submódulos y worktrees; se refresca con el watcher y con `mod+R`.

## Notas de implementación (2026-09-18)

- Rust: `LfsStatus`; `parse_gitattributes_paths` y `parse_gitattributes_uses_lfs` (comentarios fuera; token exacto `filter=lfs`); `lfs_status` tolera que `git lfs version` falle.
- En los tests de integración no se añaden ficheros que casen con `filter=lfs`: sin git-lfs instalado, `git add` intenta ejecutar el filtro y falla (justo el escenario que avisa la UI). En esta máquina git-lfs no está instalado y el aviso es visible desde el primer arranque.
- Frontend: `parseLfsPointerPatch` detecta version/oid/size ignorando prefijos de diff; aviso en File status (solo si falta git-lfs) y en el diff (siempre que el parche sea un puntero); sección Git LFS en el sidebar.
- Tests: 109 Rust (2 de parsers y 3 de integración nuevos), 179 frontend (10 nuevos).
- Cerrado el 2026-09-18 con CI verde (Frontend 41 s, Rust 1m27s) en el PR #21.
