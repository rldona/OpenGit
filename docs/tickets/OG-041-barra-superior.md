# OG-041 · Barra superior de ventana

- **Milestone:** M7 — Paridad SourceTree (fase 2)
- **Estado:** done
- **Depende de:** OG-035, OG-044
- **Bloquea parcialmente:** OG-049 (el botón Merge), OG-043 (destino del botón Commit)
- **Referencias:** ROADMAP.md, OG-035

## Contexto

OG-035 dejó una toolbar funcional pero con botones de texto en una sola fila (`App.tsx:270-330`): Open repository, Fetch, Pull, Push, Refresh, Close, Output, ayuda y un `select` de tema. SourceTree separa acciones de repositorio (izquierda, iconos grandes con etiqueta) de utilidades (derecha), y centra el nombre del repositorio en la barra de título.

## Alcance

- Acciones a la izquierda: **Commit** (con badge del número de cambios pendientes), **Pull**, **Push**, **Fetch**, **Branch**, **Stash**.
- **Merge queda fuera**: `git merge` no existe en el backend. Sale como OG-049 y se añadirá a la barra al cerrarlo.
- Utilidades a la derecha: **View Remote**, **Show in Finder**, **Terminal**, **Settings**.
- Nombre del repositorio centrado; la ruta completa queda como `title`.
- Commit navega a la vista de commit; hasta que exista (OG-043) apunta a la vista de status, que es donde vive hoy el panel de commit. Branch y Stash abren sus flujos ya existentes.
- Extraer la toolbar de `App.tsx` a su propio componente.
- Botones deshabilitados y con `aria-label` cuando no hay repo abierto o hay una operación remota en curso.

## Criterios de aceptación

- [x] Las acciones de repositorio aparecen a la izquierda con icono y etiqueta.
- [x] El badge de Commit refleja el número de cambios y desaparece cuando no hay ninguno.
- [x] Las utilidades aparecen a la derecha y "Show in Finder" abre el gestor de ficheros del sistema.
- [x] El nombre del repo se ve centrado en la barra.
- [x] Sin repo abierto solo queda activo "Open repository".
- [x] La barra de título de la ventana muestra la ruta del repositorio.
- [x] Tests: badge, estados deshabilitados y dispatch de cada acción.

## Fuera de alcance

- Personalizar qué botones se muestran.
- Rediseñar el menú nativo (OG-035 ya lo cubre).
- Implementar `git merge` (OG-049).

## Notas técnicas

- "Show in Finder" y "Terminal" son específicos por plataforma; conviene un comando Rust que resuelva el programa según el SO en vez de asumir `open`.
- "View Remote" puede apoyarse en lo hecho en OG-034 (abrir la URL del remoto).
- El `select` de tema se mueve a Settings; hasta que Settings exista, mantenerlo accesible.

## Notas de implementación (2026-09-18)

- `Toolbar` extraído de `App.tsx`, que baja de 514 a ~330 líneas. Rejilla de tres columnas (`1fr auto 1fr`) para que el nombre del repo quede centrado de verdad y no "centrado según lo que ocupen los botones".
- Botones con icono arriba y etiqueta debajo (`ToolButton`), con el badge de cambios superpuesto sobre el icono de Commit.
- **Branch y Stash no abren diálogos nuevos**: emiten una petición por el store de UI (`requestNewBranch` / `requestNewStash`) y la sidebar abre el formulario que ya tenía, desplegando su sección. Evita duplicar dos flujos de creación.
- **Settings** no existía como pantalla. En vez de dejar un botón muerto, abre un popover con el selector de tema (que antes colgaba suelto de la toolbar), el conmutador del panel de Output, los atajos y cerrar repositorio. Se cierra con Escape o pulsando fuera.
- **Show in Finder** usa `revealItemInDir` del plugin opener, con su permiso añadido en `capabilities/default.json`. Sin Rust nuevo.
- **Terminal** sí necesitó comando Rust (`open_terminal`): no hay API multiplataforma. Candidatos por plataforma en orden de preferencia y **siempre por argv**, nunca por shell: un repo llamado `foo; rm -rf ~` sería una inyección de libro (regla 3).

### Bug encontrado: el título de la ventana nunca se fijaba

`setWindowTitle` llevaba desde OG-035 fallando en silencio. El permiso por defecto de `core:window` incluye `allow-title` (leer) pero **no `allow-set-title`** (escribir), y el `.catch(() => {})` de `App.tsx` se tragaba el error de ACL. El criterio "título con la ruta del repo" de OG-035 estaba marcado como cumplido sin estarlo.

- Añadido `core:window:allow-set-title` a `capabilities/default.json`.
- El `catch` ya no es mudo: manda el motivo al panel de Output. Test de regresión incluido.
- Lección para `.ai/memory/`: un `catch` vacío sobre una llamada IPC de Tauri esconde los errores de ACL, que no son excepcionales sino de configuración. Si se traga, que sea al Output.

### Fuera de este ticket

- **Merge** no está: `git merge` no existe en el backend. Sale como OG-049.
- **Commit** apunta a la vista de status mientras no exista la vista dedicada (OG-043).
- Se valoró fusionar la barra de título al estilo Electron (`titleBarStyle: Overlay`). **Se llegó a implementar y se revirtió**: ver abajo.

### Descartado: barra de título fusionada (`titleBarStyle: Overlay`)

El objetivo era centrar la ruta del repositorio en la fila del título, como SourceTree. La alineación de esa fila la decide macOS y no se puede cambiar desde Tauri con la barra nativa, así que la única vía era dibujarla nosotros con `Overlay` + `hiddenTitle`.

Se implementó entera (config de ventana con `trafficLightPosition`, comando Rust `host_platform` para reservar hueco a los semáforos solo en macOS, `data-tauri-drag-region` y el permiso `core:window:allow-start-dragging`) y **se revirtió por decisión de producto**: el resultado gustaba menos que la barra nativa.

Queda anotado por si alguien lo reintenta:

- La alineación del título nativo **no es configurable**. O barra nativa tal cual, o dibujarla entera.
- `core:window:allow-start-dragging` **no** está en el permiso por defecto de `core:window`. Sin él la región de arrastre no hace nada y no avisa: el mismo fallo silencioso que `allow-set-title`.
- Requiere detección de plataforma, porque en Windows y Linux `titleBarStyle` se ignora y el hueco de los semáforos sobraría. Se resolvió con un comando Rust de tres líneas (`std::env::consts::OS`) en vez de añadir `@tauri-apps/plugin-os` por la regla 5.
- Sigue vigente la pega de fondo: no se puede arrastrar la ventana cuando no está enfocada ([tauri#4316](https://github.com/tauri-apps/tauri/issues/4316)).
