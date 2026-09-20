import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type RepoEventHandlers = {
  onRefsChanged: () => void;
  onIndexChanged: () => void;
  onWorktreeChanged: () => void;
  onRefreshed: () => void;
};

/** Suscribe a los eventos del watcher; devuelve las funciones para limpiar. */
export async function subscribeRepoEvents(handlers: RepoEventHandlers): Promise<UnlistenFn[]> {
  return Promise.all([
    listen("repo://refs-changed", handlers.onRefsChanged),
    listen("repo://index-changed", handlers.onIndexChanged),
    listen("repo://worktree-changed", handlers.onWorktreeChanged),
    listen("repo://refreshed", handlers.onRefreshed),
  ]);
}
