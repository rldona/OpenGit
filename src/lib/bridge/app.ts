import { invoke } from "@tauri-apps/api/core";

/** Application version from `tauri.conf.json` (baked at compile time). */
export function appVersion(): Promise<string> {
  return invoke<string>("app_version");
}
