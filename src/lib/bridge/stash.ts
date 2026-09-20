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

/** Con `drop` usa `pop`: solo borra el stash si se aplica bien. */
export function stashApply(path: string, reference: string, drop: boolean): Promise<void> {
  return invoke<void>("stash_apply", { path, reference, drop });
}

export function stashDrop(path: string, reference: string): Promise<void> {
  return invoke<void>("stash_drop", { path, reference });
}

/** Parche completo del stash, incluidos los untracked guardados con `-u`. */
export function stashShow(path: string, reference: string): Promise<string> {
  return invoke<string>("stash_show", { path, reference });
}
