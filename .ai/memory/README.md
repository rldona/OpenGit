# Memoria del proyecto

Conocimiento no obvio adquirido durante el desarrollo: peculiaridades de git, de los tres SO, de Tauri, del rendimiento o de las herramientas. Aquí se escribe lo que no merece un ADR pero ahorra tiempo la próxima vez.

## Cuándo añadir aquí

- Descubres un comportamiento raro de git (o de una versión concreta) que condiciona el código.
- Un caso de la plataforma obliga a un workaround (WebKit), Windows, rutas, DPI, empaquetado).
- Una medición de rendimiento relevante con su contexto (repo, tamaño, máquina).
- Un error que te costó más de una hora entender.

## Formato

Ficheros temáticos (`git-quirks.md`, `platform-quirks.md`, `performance.md`). Cada entrada:

```markdown
## Título corto

- **Fecha:** AAAA-MM-DD
- **Contexto:** qué estabas haciendo.
- **Hallazgo:** lo que descubriste, con comando/salida si aplica.
- **Implicación:** qué hacer (o no hacer) a partir de ahora.
```

Regla: datos, no opiniones; si algo deja de ser cierto (nueva versión de git, de Tauri), se corrige la entrada o se marca como obsoleta.
