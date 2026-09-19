import { revealItemInDir, openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";

/** Opens an http/https URL in the system browser. */
export function openExternal(url: string): Promise<void> {
  return openUrl(url);
}

/** Shows the path in the system file manager (Finder, Explorer…). */
export function revealInFileManager(path: string): Promise<void> {
  return revealItemInDir(path);
}

/** Opens a system terminal at the given path. */
export function openTerminal(path: string): Promise<void> {
  return invoke("open_terminal", { path });
}
