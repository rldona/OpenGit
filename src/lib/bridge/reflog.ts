import { invoke } from "@tauri-apps/api/core";
import type { ReflogEntry } from "./types";

/** Reads the reflog, newest first (OG-089). */
export function reflog(path: string, limit: number): Promise<ReflogEntry[]> {
  return invoke<ReflogEntry[]>("reflog", { path, limit });
}
