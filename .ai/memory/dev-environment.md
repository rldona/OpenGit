# Entorno de desarrollo

## En las sesiones de opencode, `node` no es Node

- **Fecha:** 2026-09-18
- **Contexto:** ejecutar `npm install` desde sesiones no interactivas en el Mac de desarrollo.
- **Hallazgo:** el PATH de la sesión antepone un shim de Bun (`/private/tmp/bun-node-*/node`) y no incluye Homebrew; `node --version` falla con un error del REPL de Bun. npm y cargo tampoco están en el PATH.
- **Implicación:** anteponer `export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"` en los comandos de shell. El Node real de Homebrew es la v26 y el de nvm está en `~/.nvm/versions/node`.

## Rust se instaló el 2026-09-18 con rustup

- **Fecha:** 2026-09-18
- **Contexto:** OG-001 requería compilar el núcleo Tauri; no había toolchain.
- **Hallazgo:** instalado Rust 1.98.1 con `--profile default` (incluye clippy y rustfmt) en `~/.cargo`.
- **Implicación:** usar `cargo` con `$HOME/.cargo/bin` en el PATH.

## npm 11 avisa de scripts de instalación sin aprobar

- **Fecha:** 2026-09-18
- **Contexto:** `npm install` en el proyecto.
- **Hallazgo:** npm avisa de que `fsevents` tiene un install script no aprobado (`allow-scripts`) y no lo ejecuta. No bloquea tests ni build.
- **Implicación:** si el HMR de Vite se comporta raro en macOS, aprobar el script con `npm approve-scripts`; no es necesario por ahora.

## El lock no puede apuntar al registry corporativo

- **Fecha:** 2026-09-18
- **Contexto:** primer CI en GitHub Actions; el job de frontend falló en 7 s con `npm error code E401`.
- **Hallazgo:** el `~/.npmrc` de esta máquina configura un Artifactory corporativo, así que `npm install` escribió las 276 URLs `resolved` del lock contra ese host. GitHub no tiene (ni debe tener) esas credenciales.
- **Implicación:** el `package-lock.json` debe resolver contra `https://registry.npmjs.org`. El `.npmrc` del repo fija `registry=https://registry.npmjs.org/` (npmjs es alcanzable desde la máquina de desarrollo) para que cualquier `npm install` escriba URLs públicas.
- **Ojo con `replace-registry-host=always`:** no sirve como arreglo. Solo sustituye el **host** del lock por el registry configurado, pero deja la ruta corporativa (`/artifactory/api/npm/...`), generando URLs rotas en CI (404 en vez de E401). Se probó y se descartó.

## Los commits van con el noreply de GitHub, no con la cuenta corporativa

- **Fecha:** 2026-09-18
- **Contexto:** el historial del repo se creó con el `user.email` global de la máquina (cuenta corporativa) y hubo que reescribirlo.
- **Hallazgo:** el repo no tenía identidad propia; `git config --global user.email` apunta a la cuenta de empresa. Se reescribieron autor y committer con `git filter-branch --env-filter` conservando fechas, y se fuerza-pushearon `main` y las ramas.
- **Implicación:** el repo fija en su config local `user.name=Raúl López` y `user.email=rldona@users.noreply.github.com`; AGENTS.md lo exige como regla 11. Si algún commit sale con otro correo, se corrige antes de pushear.

## No cambies de rama con `tauri dev` corriendo

- **Fecha:** 2026-09-18
- **Contexto:** `npm run tauri dev` en marcha mientras se hizo `git checkout main` + `git pull` (el pull escribió de nuevo todo el árbol).
- **Hallazgo:** Vite detectó el cambio de `vite.config.ts`, reinició el servidor y se quedó en el puerto 5174 en vez de 1420 (5173 estaba ocupado por otro proyecto), pese a `strictPort`. La ventana Tauri siguió cargando `devUrl` (1420), que ya no respondía → pantalla blanca. En el log: `Port 5173 is in use, trying another one...` y `Local: http://localhost:5174/`.
- **Implicación:** no hacer checkout/pull con el dev server vivo. Si pasa: parar todo (`pkill -f "opengit/node_modules/.bin/vite"; pkill -f target/debug/opengit`) y relanzar `npm run tauri dev`, comprobando en el log `http://localhost:1420/` antes de dar por buena la ventana.

## Los TempDir de los tests deben ser únicos aunque el reloj se repita

- **Fecha:** 2026-09-18
- **Contexto:** tests de integración de Rust en paralelo; fallos aleatorios de un test distinto en cada pasada (detached HEAD, errores de git, diffs).
- **Hallazgo:** `TempDir::new` generaba el nombre con `pid + nanos`; dos hilos podían obtener el mismo `nanos` y compartir carpeta, pisándose y borrándose entre tests.
- **Implicación:** el nombre incluye ahora un contador atómico (`AtomicU64`). Si los tests vuelven a fallar de forma no determinista, sospechar primero de recursos compartidos (temp dirs, puertos, ficheros de config).
