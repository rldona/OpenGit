---
name: tauri-ipc
description: Use when adding or changing communication between the React UI and the Rust core in Tauri 2 (commands, invoke, events, streaming progress, cancellation, error types). Triggers on invoke, tauri command, IPC, event, listen, emit, bridge, serialization. Covers naming, error shapes, async safety and payload limits.
---

# Puente UI ↔ Rust (Tauri 2)

## Comandos

```rust
#[tauri::command]
async fn log_page(repo: String, skip: u32, limit: u32) -> Result<LogPage, GitError> { ... }
```

- Nombres de comando en `snake_case`; argumentos en `camelCase` desde TS (Tauri los mapea).
- Devuelve tipos serializables y **siempre** `Result<T, E>` con un `E` tipado (`GitError`: kind, message, stderr, exit_code, retryable).
- Nada de bloquear: las operaciones git son I/O; usa `tauri::async_runtime::spawn_blocking` o jobs en hilos propios. Nunca ejecutes git directamente en el handler async.
- Comandos largos (fetch/pull/push) devuelven un `job_id` inmediatamente y emiten progreso por eventos.
- Cancelación explícita: comando `cancel_job(job_id)` que mata el proceso y limpia.

## Frontend

- Un único módulo bridge (`src/lib/bridge/`) con una función tipada por comando. Prohibido `invoke("...")` suelto por los componentes.
- Tipos TS espejo de los modelos Rust en un solo fichero; si divergen, el bug es del bridge.
- Eventos con nombre de dominio: `repo://refs-changed`, `job://progress`, `job://finished`.
- Suscripción con `listen` dentro de un `useEffect` con cleanup; nunca listeners duplicados.
- Los errores del bridge se convierten en un objeto uniforme para la UI (toast, panel de salida o estado de error según el caso).

## Payloads

- Paginado siempre: máximo de commits/diffs por mensaje. No serializar 100 000 commits.
- Los ficheros grandes se piden al clic, no al cargar la vista.
- Prefiere IDs y referencias a duplicar estructuras grandes entre eventos.

## Anti-patrones

- `invoke` disperso por componentes.
- Handlers `async` que hacen `Command::output()` bloqueante sin `spawn_blocking`.
- Eventos sin job ni correlación (imposible saber a qué operación pertenecen).
- Estado global en Rust guardado en `Mutex` sin `State` de Tauri o sin limpieza al cerrar repo.
- Devolver `String` de error genérico: la UI no puede distinguir auth de non-fast-forward.
