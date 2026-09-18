import { invoke } from "@tauri-apps/api/core";
import type { Commit, RefEntry } from "./types";

export function logPage(
  path: string,
  skip: number,
  limit: number,
  rev: string | null,
): Promise<Commit[]> {
  return invoke<Commit[]>("log_page", { path, skip, limit, rev });
}

export function listRefs(path: string): Promise<RefEntry[]> {
  return invoke<RefEntry[]>("list_refs", { path });
}
