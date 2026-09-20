import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { JobFinishedEvent, JobOutputEvent } from "./types";

export type RepoEventHandlers = {
  onRefsChanged: (root: string) => void;
  onIndexChanged: (root: string) => void;
  onWorktreeChanged: (root: string) => void;
  onRefreshed: (root: string) => void;
};

/**
 * Subscribes to watcher events; returns the cleanup functions. The payload is
 * the root of the repo that emitted the event, so a listener can ignore events
 * from a repository that is no longer open.
 */
export async function subscribeRepoEvents(handlers: RepoEventHandlers): Promise<UnlistenFn[]> {
  return Promise.all([
    listen<string>("repo://refs-changed", (event) => handlers.onRefsChanged(event.payload)),
    listen<string>("repo://index-changed", (event) => handlers.onIndexChanged(event.payload)),
    listen<string>("repo://worktree-changed", (event) => handlers.onWorktreeChanged(event.payload)),
    listen<string>("repo://refreshed", (event) => handlers.onRefreshed(event.payload)),
  ]);
}

export type JobEventHandlers = {
  onOutput: (payload: JobOutputEvent) => void;
  onFinished: (payload: JobFinishedEvent) => void;
};

/** Subscribes to fetch/pull/push output; returns the cleanup functions. */
export async function subscribeJobEvents(handlers: JobEventHandlers): Promise<UnlistenFn[]> {
  return Promise.all([
    listen<JobOutputEvent>("job://output", (event) => handlers.onOutput(event.payload)),
    listen<JobFinishedEvent>("job://finished", (event) => handlers.onFinished(event.payload)),
  ]);
}

/** Subscribes to native menu clicks; returns the cleanup function. */
export function subscribeMenuEvents(handler: (id: string) => void): Promise<UnlistenFn> {
  return listen<string>("menu-action", (event) => handler(event.payload));
}
