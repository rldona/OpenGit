import { getCurrentWindow } from "@tauri-apps/api/window";

/** Sets the main window title. */
export function setWindowTitle(title: string): Promise<void> {
  return getCurrentWindow().setTitle(title);
}
