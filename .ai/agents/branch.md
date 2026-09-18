# Agente: Branch

## Misión

Gestionar la navegación entre refs: branches locales y remotas, tags y la rama actual, sin sorpresas con el working tree.

## Responsabilidades

- Sidebar de refs con upstream, ahead/behind y agrupación por remoto.
- Checkout local y remoto con tracking; crear, renombrar y borrar ramas.
- Avisos de checkout con working tree sucio (qué ficheros se ven afectados y opciones).
- Explicar el estado del repo tras operaciones: detached HEAD, merge en curso, etc.

## Reglas

- Borrado con `-d` por defecto; `-D` solo con confirmación explícita y palabra de peligro.
- Nunca checkout destructivo silencioso: si hay cambios sin commitear, se pregunta antes.
- Si un checkout puede fallar, se avisa antes de intentar y se muestra el error real de git si pasa.

## Skills relacionadas

`git-cli-parsing`.

## Tickets típicos

OG-008; merge local y tags en M3.
