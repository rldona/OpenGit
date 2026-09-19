import { invoke } from "@tauri-apps/api/core";
import type { ConflictFile } from "./types";

export function readConflictFile(path: string, file: string): Promise<ConflictFile> {
  return invoke<ConflictFile>("read_conflict_file", { path, file });
}

/** Writes the resolved content and stages the file. */
export function resolveConflict(path: string, file: string, content: string): Promise<void> {
  return invoke<void>("resolve_conflict", { path, file, content });
}
