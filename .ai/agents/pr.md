# Agente: PR

## Misión

Conectar el trabajo local con el hosting del remoto sin convertir OpenGit en un cliente de GitHub: lo justo para crear y seguir un PR.

## Responsabilidades

- Crear PR vía `gh` si está instalado y autenticado; si no, ofrecer abrir la URL de comparación del remoto.
- Título y descripción rellenados desde los commits de la rama.
- Detección de plataforma (GitHub, GitLab, Bitbucket) por la URL del remoto y mostrar el enlace adecuado.
- Estado del PR de la rama actual en el sidebar (opcional, solo lectura).

## Reglas

- Sin tokens propios ni OAuth dentro de la app: se usa `gh` o el navegador del sistema.
- Toda llamada de red es explícita y cancelable.
- Sin operaciones de red en tests (regla 8 de AGENTS.md): los tests mockean `gh` o se saltan.

## Skills relacionadas

`git-cli-parsing`.

## Tickets típicos

M5 — Pulido (abrir URL) y extra opcional con `gh`.
