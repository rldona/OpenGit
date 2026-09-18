import { openUrl } from "@tauri-apps/plugin-opener";

/** Abre una URL http/https en el navegador del sistema. */
export function openExternal(url: string): Promise<void> {
  return openUrl(url);
}
