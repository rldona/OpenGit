import { invoke } from "@tauri-apps/api/core";

/** Cancela la operación en curso (merge, rebase, cherry-pick o revert). */
export function repoOpAbort(path: string): Promise<void> {
  return invoke<void>("repo_op_abort", { path });
}

/** Continúa la operación en curso aceptando el mensaje por defecto. */
export function repoOpContinue(path: string): Promise<void> {
  return invoke<void>("repo_op_continue", { path });
}

/** Salta el commit o patch conflictivo (no disponible en merge). */
export function repoOpSkip(path: string): Promise<void> {
  return invoke<void>("repo_op_skip", { path });
}
