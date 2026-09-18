import { getCurrentWindow } from "@tauri-apps/api/window";

/** Fija el título de la ventana principal. */
export function setWindowTitle(title: string): Promise<void> {
  return getCurrentWindow().setTitle(title);
}
