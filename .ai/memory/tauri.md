# Tauri

## `app_data_dir` para el estado persistido

- **Fecha:** 2026-09-18
- **Contexto:** persistir los repositorios recientes (OG-002) sin escribir en el repo del usuario.
- **Hallazgo:** `app.path().app_data_dir()` resuelve a `~/Library/Application Support/<identifier>` en macOS (equivalentes en Windows/Linux) y es la misma ruta en dev y en release. Hay que crear la carpeta antes de escribir.
- **Implicación:** `recent_repos.json` vive ahí vía `AppState`; los tests inyectan una ruta temporal en `Recents`, nunca la real.

## Los plugins requieren permiso explícito en capabilities

- **Fecha:** 2026-09-18
- **Contexto:** selector nativo de carpetas con `tauri-plugin-dialog`.
- **Hallazgo:** sin `dialog:allow-open` en `src-tauri/capabilities/default.json` el comando compila pero `open()` falla en runtime con un error de permisos.
- **Implicación:** al añadir un plugin, añadir a la capability el permiso mínimo que use la UI (no `*:default` por comodidad).

## Abrir URLs externas: `tauri-plugin-opener` con scope

- **Fecha:** 2026-09-18
- **Contexto:** OG-034, abrir la URL del remoto en el navegador del sistema.
- **Hallazgo:** `window.open` abriría una ventana del WebView; la vía oficial en Tauri 2 es `tauri-plugin-opener`. El permiso admite scope por URL: `{ "identifier": "opener:allow-open-url", "allow": [{ "url": "https://*" }, { "url": "http://*" }] }`; sin él, el plugin compila pero falla en runtime. El build de Tauri valida la capability al compilar.
- **Implicación:** para acciones externas, usar el plugin con permiso limitado al esquema necesario; nunca `opener:default` sin scope si solo se abren URLs web.

## Los comandos del núcleo (`core:*`) también necesitan permiso, y fallan en silencio

- **Fecha:** 2026-09-18
- **Contexto:** OG-041; la barra de título seguía poniendo "OpenGit" con un repo abierto, pese a que `App.tsx` llamaba a `setWindowTitle(repo.root)` desde OG-035.
- **Hallazgo:** `core:default` **no** incluye todos los comandos del núcleo. En `core:window`, el permiso por defecto trae `allow-title` (leer el título) pero no `allow-set-title` (escribirlo). A diferencia de los plugins, aquí es fácil suponer que `core:default` lo cubre todo. El error de ACL llega como rechazo de la promesa de `invoke`, y un `.catch(() => {})` lo hace invisible: la feature parecía implementada y estaba muerta desde hacía un hito entero.
- **Implicación:** dos reglas. (1) Comprobar los permisos concretos de `core:*`, no fiarse de `core:default`; se listan en `src-tauri/gen/schemas/acl-manifests.json` bajo `default_permission.permissions`. (2) **Nunca tragarse en silencio el error de una llamada IPC**: si no se puede tratar, mandarlo al panel de Output. Un catch vacío sobre `invoke` esconde errores de configuración, que son permanentes, no esporádicos.
