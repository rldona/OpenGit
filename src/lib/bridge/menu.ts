import { invoke } from "@tauri-apps/api/core";

/** Rebuilds the native menu with the labels of `locale` (OG-106). */
export function setMenuLocale(locale: string): Promise<void> {
  return invoke<void>("set_menu_locale", { locale });
}
