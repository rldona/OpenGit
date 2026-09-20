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

/** Reverts `hash`; a merge commit needs the 1-based `mainline` parent (OG-092). */
export function revertCommit(path: string, hash: string, mainline: number | null): Promise<void> {
  return invoke<void>("revert_commit", { path, hash, mainline });
}

/** How a reset treats the index and the working tree (OG-091). */
export type ResetMode = "soft" | "mixed" | "hard";

/** Moves the current branch to `hash`; `mode` decides the index and worktree. */
export function resetTo(path: string, hash: string, mode: ResetMode): Promise<void> {
  return invoke<void>("reset_to", { path, hash, mode });
}
