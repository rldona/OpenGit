import { invoke } from "@tauri-apps/api/core";
import type { Commit, LogSearch, RefEntry } from "./types";

function searchPayload(search: LogSearch | null) {
  if (!search) {
    return null;
  }
  return {
    grep: search.grep.trim() === "" ? null : search.grep.trim(),
    author: search.author.trim() === "" ? null : search.author.trim(),
    path: search.path.trim() === "" ? null : search.path.trim(),
  };
}

export function logPage(
  path: string,
  skip: number,
  limit: number,
  rev: string | null,
  search: LogSearch | null = null,
): Promise<Commit[]> {
  return invoke<Commit[]>("log_page", { path, skip, limit, rev, search: searchPayload(search) });
}

export function listRefs(path: string): Promise<RefEntry[]> {
  return invoke<RefEntry[]>("list_refs", { path });
}
