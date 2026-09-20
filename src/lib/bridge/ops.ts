import { invoke } from "@tauri-apps/api/core";

/** Cancels the operation in progress (merge, rebase, cherry-pick or revert). */
export function repoOpAbort(path: string): Promise<void> {
  return invoke<void>("repo_op_abort", { path });
}

/** Continues the operation in progress accepting the default message. */
export function repoOpContinue(path: string): Promise<void> {
  return invoke<void>("repo_op_continue", { path });
}

/** Skips the conflicting commit or patch (not available for merge). */
export function repoOpSkip(path: string): Promise<void> {
  return invoke<void>("repo_op_skip", { path });
}
