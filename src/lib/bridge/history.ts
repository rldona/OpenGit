import { invoke } from "@tauri-apps/api/core";

export function cherryPick(path: string, hash: string): Promise<void> {
  return invoke<void>("cherry_pick", { path, hash });
}

export function revertCommit(path: string, hash: string): Promise<void> {
  return invoke<void>("revert_commit", { path, hash });
}

/** Mixed reset: moves the branch and unstages, without touching the files. */
export function resetMixed(path: string, hash: string): Promise<void> {
  return invoke<void>("reset_mixed", { path, hash });
}
