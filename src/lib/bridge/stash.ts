import { invoke } from "@tauri-apps/api/core";
import type { Stash } from "./types";

export function stashList(path: string): Promise<Stash[]> {
  return invoke<Stash[]>("stash_list", { path });
}

export function stashPush(
  path: string,
  message: string | null,
  includeUntracked: boolean,
): Promise<void> {
  return invoke<void>("stash_push", { path, message, includeUntracked });
}

/** With `drop` it uses `pop`: it only deletes the stash if it applies cleanly. */
export function stashApply(path: string, reference: string, drop: boolean): Promise<void> {
  return invoke<void>("stash_apply", { path, reference, drop });
}

export function stashDrop(path: string, reference: string): Promise<void> {
  return invoke<void>("stash_drop", { path, reference });
}

/** Full stash patch, including untracked files saved with `-u`. */
export function stashShow(path: string, reference: string): Promise<string> {
  return invoke<string>("stash_show", { path, reference });
}
