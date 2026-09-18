import { invoke } from "@tauri-apps/api/core";

export function tagCreate(
  path: string,
  name: string,
  target: string,
  message: string | null,
): Promise<void> {
  return invoke<void>("tag_create", { path, name, target, message });
}

export function tagDelete(path: string, name: string): Promise<void> {
  return invoke<void>("tag_delete", { path, name });
}
