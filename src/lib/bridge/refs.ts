import { invoke } from "@tauri-apps/api/core";
import type { BranchTracking } from "./types";

export function branchTracking(path: string): Promise<BranchTracking> {
  return invoke<BranchTracking>("branch_tracking", { path });
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

/** `force = false` usa `-d`; `-D` solo tras confirmación explícita. */
export function deleteBranch(path: string, name: string, force: boolean): Promise<void> {
  return invoke<void>("delete_branch", { path, name, force });
}
