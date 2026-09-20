import { invoke } from "@tauri-apps/api/core";

/** Scope of a git config entry. */
export type ConfigScope = "local" | "global";

/** Reads a git config value; `null` when it is not set. */
export function configGet(path: string, key: string, scope: ConfigScope): Promise<string | null> {
  return invoke<string | null>("config_get", { path, key, scope });
}

/** Writes a git config value in the given scope. */
export function configSet(
  path: string,
  key: string,
  value: string,
  scope: ConfigScope,
): Promise<void> {
  return invoke<void>("config_set", { path, key, value, scope });
}

/** Removes a git config value; a missing entry is not an error. */
export function configUnset(path: string, key: string, scope: ConfigScope): Promise<void> {
  return invoke<void>("config_unset", { path, key, scope });
}

/** Absolute path of the repository-specific ignore file (`info/exclude`). */
export function ignoreExcludePath(path: string): Promise<string> {
  return invoke<string>("ignore_exclude_path", { path });
}

/** Turns the watcher events on or off for the open repository. */
export function setAutoRefresh(enabled: boolean): Promise<void> {
  return invoke<void>("set_auto_refresh", { enabled });
}

/** Opens a file or folder with the system default application. */
export function openPath(path: string): Promise<void> {
  return invoke<void>("open_path", { path });
}

/** Contents of the repository commit template; empty when there is none. */
export function commitTemplateRead(path: string): Promise<string> {
  return invoke<string>("commit_template_read", { path });
}

/** Writes the template and points `commit.template` at it; returns the path. */
export function commitTemplateWrite(path: string, contents: string): Promise<string> {
  return invoke<string>("commit_template_write", { path, contents });
}

/** Reads a small UTF-8 file (the template "Import…"). */
export function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}
