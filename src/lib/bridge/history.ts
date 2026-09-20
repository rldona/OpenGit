import { invoke } from "@tauri-apps/api/core";
import type { MergeResult } from "./types";

export function cherryPick(path: string, hash: string): Promise<void> {
  return invoke<void>("cherry_pick", { path, hash });
}

/** Cherry-picks several commits or a range (OG-096). */
export function cherryPickRange(
  path: string,
  revs: string[],
  recordSource: boolean,
): Promise<MergeResult> {
  return invoke<MergeResult>("cherry_pick_range", { path, revs, recordSource });
}

export function revertCommit(path: string, hash: string): Promise<void> {
  return invoke<void>("revert_commit", { path, hash });
}

/** Mixed reset: moves the branch and unstages, without touching the files. */
export function resetMixed(path: string, hash: string): Promise<void> {
  return invoke<void>("reset_mixed", { path, hash });
}
