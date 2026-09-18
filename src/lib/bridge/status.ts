import { invoke } from "@tauri-apps/api/core";
import type { StatusReport } from "./types";

export function statusRepo(path: string): Promise<StatusReport> {
  return invoke<StatusReport>("status_repo", { path });
}

export function stagePath(path: string, file: string, origFile: string | null): Promise<void> {
  return invoke<void>("stage_path", { path, file, origFile });
}

export function unstagePath(path: string, file: string, origFile: string | null): Promise<void> {
  return invoke<void>("unstage_path", { path, file, origFile });
}

/** Destructivo: confirmar antes en la UI. */
export function discardPath(path: string, file: string, origFile: string | null): Promise<void> {
  return invoke<void>("discard_path", { path, file, origFile });
}

/** Destructivo: confirmar antes en la UI. */
export function deleteUntracked(path: string, file: string): Promise<void> {
  return invoke<void>("delete_untracked", { path, file });
}
