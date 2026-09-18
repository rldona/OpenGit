# Workflow: release

> Aplica a partir de M5. Hasta entonces, no hay artefactos públicos.

1. `main` en verde (CI de los tres SO) y `ROADMAP.md` actualizado.
2. Actualiza la versión en `package.json` y `src-tauri/tauri.conf.json` (misma versión).
3. Entrada en `CHANGELOG.md` (si existe) generada desde los commits desde el último tag.
4. Tag anotado: `git tag -a vX.Y.Z -m "OpenGit vX.Y.Z"`.
5. Push del tag: dispara el workflow de release, que compila y firma para macOS, Windows y Linux y crea la release en GitHub.
6. Verifica artefactos: instala en al menos un SO distinto al de desarrollo y comprueba arranque, abrir repo y grafo.
7. Si algo falla: no se mueve el tag. Se corrige, se sube la versión de parche y se publica `vX.Y.(Z+1)`.

## Versionado

- `0.x.y` hasta M5: puede romper compatibilidad entre versiones.
- `1.0.0` cuando el ciclo diario (M1+M2) sea sólido.
