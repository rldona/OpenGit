import { formatGitError } from "./bridge/errors";
import { openEditor, revealInFileManager } from "./bridge/opener";
import { openPath } from "./bridge/settings";
import { useUiStore } from "./stores/ui";

/** Absolute path of a worktree-relative file. */
export function worktreePath(root: string, path: string): string {
  return `${root}/${path}`;
}

/**
 * Message of a failed open/reveal. Prefers the backend `message` (used by
 * the opener commands) over the generic git formatter.
 */
export function openErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return formatGitError(error);
}

function report(action: string, full: string, error: unknown): void {
  useUiStore.getState().appendOutput(`${action} ${full}: ${openErrorMessage(error)}`);
}

/** Opens the file with the system default application. */
export function openFileDefault(root: string, path: string): void {
  const full = worktreePath(root, path);
  void openPath(full).catch((error: unknown) => report("Could not open", full, error));
}

/** Opens the file in Visual Studio Code. */
export function openFileEditor(root: string, path: string): void {
  const full = worktreePath(root, path);
  void openEditor(full).catch((error: unknown) => report("Could not open in VS Code", full, error));
}

/** Reveals the file in the system file manager. */
export function revealFile(root: string, path: string): void {
  const full = worktreePath(root, path);
  void revealInFileManager(full).catch((error: unknown) => report("Could not reveal", full, error));
}
