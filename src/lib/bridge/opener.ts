import { revealItemInDir, openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";

/** Abre una URL http/https en el navegador del sistema. */
export function openExternal(url: string): Promise<void> {
  return openUrl(url);
}

/** Muestra la ruta en el gestor de ficheros del sistema (Finder, Explorer…). */
export function revealInFileManager(path: string): Promise<void> {
  return revealItemInDir(path);
}

/** Abre un terminal del sistema en la ruta indicada. */
export function openTerminal(path: string): Promise<void> {
  return invoke("open_terminal", { path });
}
