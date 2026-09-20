import { invoke } from "@tauri-apps/api/core";
import type { BranchTracking, MergeOptions, MergeResult, TrackingCommits } from "./types";

export function branchTracking(path: string): Promise<BranchTracking> {
  return invoke<BranchTracking>("branch_tracking", { path });
}

/** Hashes of `HEAD..upstream` (incoming) and `upstream..HEAD` (outgoing). */
export function trackingCommits(path: string, upstream: string): Promise<TrackingCommits> {
  return invoke<TrackingCommits>("tracking_commits", { path, upstream });
}

export function checkoutRef(path: string, target: string, track: boolean): Promise<void> {
  return invoke<void>("checkout_ref", { path, target, track });
}

export function createBranch(path: string, name: string, startPoint: string): Promise<void> {
  return invoke<void>("create_branch", { path, name, startPoint });
}

export function renameBranch(path: string, old: string, newName: string): Promise<void> {
  return invoke<void>("rename_branch", { path, old, newName });
}

/** `force = false` uses `-d`; `-D` only after explicit confirmation. */
export function deleteBranch(path: string, name: string, force: boolean): Promise<void> {
  return invoke<void>("delete_branch", { path, name, force });
}

/** Merges `rev` into the current branch; a conflict is not an error. */
export function mergeBranch(
  path: string,
  rev: string,
  options: MergeOptions,
): Promise<MergeResult> {
  return invoke<MergeResult>("merge_branch", { path, rev, options });
}
