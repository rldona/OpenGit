import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { JobFinishedEvent, JobOutputEvent } from "./types";

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

export type JobEventHandlers = {
  onOutput: (payload: JobOutputEvent) => void;
  onFinished: (payload: JobFinishedEvent) => void;
};

/** Suscribe a la salida de fetch/pull/push; devuelve las funciones para limpiar. */
export async function subscribeJobEvents(handlers: JobEventHandlers): Promise<UnlistenFn[]> {
  return Promise.all([
    listen<JobOutputEvent>("job://output", (event) => handlers.onOutput(event.payload)),
    listen<JobFinishedEvent>("job://finished", (event) => handlers.onFinished(event.payload)),
  ]);
}
