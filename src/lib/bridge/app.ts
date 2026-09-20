import { invoke } from "@tauri-apps/api/core";

/** Application version from `tauri.conf.json` (baked at compile time). */
export function appVersion(): Promise<string> {
  return invoke<string>("app_version");
}

/** Repository a new window must open, once (ADR-0008); `null` for the main one. */
export function initialRepo(): Promise<string | null> {
  return invoke<string | null>("initial_repo");
}

/** Opens a repository in a new window (ADR-0008). */
export function openRepoInNewWindow(path: string): Promise<void> {
  return invoke<void>("open_repo_in_new_window", { path });
}
