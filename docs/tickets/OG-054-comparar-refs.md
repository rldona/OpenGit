# OG-054 · Comparar commits y ramas

- **Milestone:** M8 — Paridad SourceTree (fase 3)
- **Estado:** ready
- **Depende de:** OG-005, OG-037
- **Referencias:** ROADMAP.md, OG-039

## Contexto

Hoy el diff siempre es "algo contra su padre" (commit) o "contra HEAD"
(working tree). SourceTree deja seleccionar dos commits o dos ramas y ver el
diff **entre ellos**, que es la forma de responder "¿qué cambia esta rama
respecto a main?" sin checkout.

## Alcance

- Selección múltiple en la tabla de commits (Ctrl/Cmd+clic, máximo dos) con
  indicación visual y orden base → comparado.
- "Compare selected" en el menú contextual de commits y de ramas de la
  sidebar; reutiliza la vista Diff con un target nuevo `compare`.
- Cabecera del panel con `base..rev` y botón para salir de la comparación.
- Backend: `diff_numstat` y `diff_file` aceptan el par base/rev (hoy `rev` es
  único: `git diff <base> <rev> -- <file>`).

## Criterios de aceptación

- [ ] Seleccionar dos commits y "Compare selected" abre el diff entre ambos.
- [ ] Lo mismo con dos ramas (Ctrl/Cmd+clic en la sidebar).
- [ ] El panel indica base y comparado, y volver deja la vista como estaba.
- [ ] Ficheros añadidos/borrados/renombrados se listan y se abren bien.
- [ ] Tests de parser/comando en Rust y de UI con el bridge mockeado.

## Fuera de alcance

- Historial de comparaciones.
- Comparar más de dos refs.
- Merge tool de tres vías.

## Notas técnicas

- Extender el diff store con `target: { kind: "compare", base, rev }` y un
  comando que reutilice `parse_numstat`/`diff_file` con dos revisiones.
- La selección múltiple no debe romper el detalle de un commit: con dos
  filas marcadas, el panel inferior pasa a mínimo (o se bloquea).
