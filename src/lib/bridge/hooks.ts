import { invoke } from "@tauri-apps/api/core";
import type { Hook } from "./types";

/** Hooks present in the repository's hooks directory (OG-098). */
export function hooksList(path: string): Promise<Hook[]> {
  return invoke<Hook[]>("hooks_list", { path });
}

/** Hook contents; falls back to `.disabled` and then to the sample. */
export function hookRead(path: string, name: string): Promise<string> {
  return invoke<string>("hook_read", { path, name });
}

/** Writes a hook and marks it executable on Unix. */
export function hookWrite(path: string, name: string, contents: string): Promise<void> {
  return invoke<void>("hook_write", { path, name, contents });
}

/** Enables or disables a hook without deleting its contents. */
export function hookSetEnabled(path: string, name: string, enabled: boolean): Promise<void> {
  return invoke<void>("hook_set_enabled", { path, name, enabled });
}
