# Watcher de `.git`

## Debounce por tipo y pausa durante operaciones propias

- **Fecha:** 2026-09-18
- **Contexto:** OG-010; había que evitar tormentas de refrescos y bucles con las propias escrituras de la app.
- **Diseño:**
  - `notify` observa `.git` en modo recursivo; los eventos de acceso (`EventKind::Access`) se descartan para no reaccionar a nuestras lecturas.
  - Los eventos se acumulan en una máscara por tipo y se emiten al pasar 250 ms sin novedades: diez `git add` seguidos producen un solo `repo://index-changed`.
  - La pausa es un contador atómico: los comandos de escritura pausan, ejecutan y reanudan; si hubo cambios, al reanudar se emite un único `repo://refreshed`.
  - Si `notify` no puede arrancar (contenedores, volúmenes de red), se cae a polling de 5 s.
- **Implicación:** cualquier comando nuevo que escriba en el repo debe envolverse en `pause_while`; y las lecturas masivas deben seguir usando `GIT_OPTIONAL_LOCKS=0` para no tocar el index. En macOS los FSEvents llegan a nivel de directorio: clasificar por nombre de fichero, no asumir rutas exactas.
