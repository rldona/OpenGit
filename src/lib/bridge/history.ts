import { invoke } from "@tauri-apps/api/core";

export function cherryPick(path: string, hash: string): Promise<void> {
  return invoke<void>("cherry_pick", { path, hash });
}

export function revertCommit(path: string, hash: string): Promise<void> {
  return invoke<void>("revert_commit", { path, hash });
}

/** Reset mixed: mueve la rama y desestagea, sin tocar los ficheros. */
export function resetMixed(path: string, hash: string): Promise<void> {
  return invoke<void>("reset_mixed", { path, hash });
}
