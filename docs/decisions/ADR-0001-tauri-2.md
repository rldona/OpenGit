# ADR-0001 · Shell de escritorio basado en Tauri 2

- **Estado:** aceptado
- **Fecha:** 2026-09-18
- **Decisores:** Raúl López

## Contexto

OpenGit debe funcionar en Windows, macOS y Linux desde un único código. El núcleo (ejecución de git, parseo, watcher de `.git`) se quiere en Rust. Es un proyecto personal: el coste de distribución importa menos que la velocidad de iteración, pero se busca algo ligero y sin runtime empaquetado.

## Decisión

Usar **Tauri 2** como shell: webview del sistema para la UI y proceso Rust para el core, comunicados por IPC (`invoke` y eventos).

## Alternativas consideradas

- **Electron** — ecosistema maduro y cero sorpresas, pero empaqueta Chromium y Node: binarios de >100 MB y consumo de RAM alto para una app que pasa el día abierta.
- **Qt / C++ o Python** — máximo control, pero UI más lenta de iterar y dos lenguajes; el ecosistema de componentes para diff/editores es pobre comparado con la web.
- **Flutter desktop** — buen rendimiento, pero integración con Rust y con editores de código web es peor; toolchain menos probada para este caso.

## Consecuencias

- Binarios del orden de 10–20 MB y arranque rápido.
- El webview es distinto en cada SO (WebView2 en Windows, WebKitGTK en Linux, WKWebView en macOS): **hay que verificar la UI en los tres**, especialmente rendering de canvas y atajos.
- Permisos y capacidades de Tauri 2 se declaran explícitamente: superficie de ataque pequeña, pero más ceremonia al añadir plugins.
- Depuración mixta (DevTools del webview + logs de Rust) y CI con matriz de tres sistemas desde M0.
