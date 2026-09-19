# OG-055 · Blame por línea

- **Milestone:** M8 — Paridad SourceTree (fase 3)
- **Estado:** ready
- **Depende de:** OG-005, OG-037
- **Referencias:** ROADMAP.md, OG-053

## Contexto

Ante una línea rara, la pregunta es siempre "¿quién y cuándo la escribió y en
qué commit?". El historial por fichero (OG-053) acerca, pero no responde por
línea; blame sí, y SourceTree lo tiene.

## Alcance

- Comando Rust `blame_file(path, file)` con `git blame --line-porcelain -M`
  (detección de líneas movidas dentro del fichero) y parser propio con
  fixtures; nunca parsear salida "humana".
- Vista de blame: número de línea, autor, fecha relativa y hash corto, con el
  contenido de la línea.
- Clic en una línea salta al commit en el historial (reutiliza `select`).
- "Blame" en el menú contextual de ficheros del historial y del status.

## Criterios de aceptación

- [ ] Abrir el blame de un fichero muestra una fila por línea con autor,
      fecha y commit.
- [ ] Clic en una fila abre ese commit en el historial, seleccionado.
- [ ] Binario o fichero sin trackear: mensaje claro, sin error crudo.
- [ ] Ficheros grandes responden sin bloquear la UI.
- [ ] Tests de parser con fixtures y de vista con el bridge mockeado.

## Fuera de alcance

- Anotaciones ignorando blancos (`-w`, `-M` ya cubierto).
- Culpar rangos de líneas.
- Vista de blame lado a lado con el contenido original.

## Notas técnicas

- `--line-porcelain` es estable y está pensado para parsers; separar registros
  por cabeceras de commit repetidas y quedarse con la última.
- El hash de cada línea llega en la cabecera; la fecha y autor pueden venir de
  la cabecera o de un bloque `author`/`author-time` posterior: documentar el
  parser con un fixture real.
