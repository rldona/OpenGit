import { invoke } from "@tauri-apps/api/core";
import type { GrepQuery, GrepResult } from "./types";

/** Searches the working tree with `git grep` (OG-093). */
export function grepWorktree(path: string, query: GrepQuery): Promise<GrepResult> {
  return invoke<GrepResult>("grep_worktree", { path, query });
}
