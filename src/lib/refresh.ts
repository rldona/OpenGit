import { useExtrasStore } from "./stores/extras";
import { useLogStore } from "./stores/log";
import { useRefsStore } from "./stores/refs";
import { useStashStore } from "./stores/stash";
import { useStatusStore } from "./stores/status";

/**
 * Reloads every repository-derived store from a single place (OG-065): the
 * Refresh button, the native menu and the git watcher all go through here, so
 * they cannot drift (the button used to skip stashes). It is silent on
 * purpose: the watcher calls it on every event and must not spam the Output
 * panel.
 */
export async function refreshRepo(root: string): Promise<void> {
  await Promise.all([
    useLogStore.getState().reload(root),
    useStatusStore.getState().refresh(root),
    useRefsStore.getState().refresh(root),
    useExtrasStore.getState().refresh(root),
    useStashStore.getState().refresh(root),
  ]);
}
