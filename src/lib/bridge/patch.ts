import { invoke } from "@tauri-apps/api/core";

/** Writes patch files for a commit (`single`) or a range up to HEAD (OG-094). */
export function formatPatch(
  path: string,
  spec: string,
  single: boolean,
  outDir: string,
): Promise<string[]> {
  return invoke<string[]>("format_patch", { path, spec, single, outDir });
}

/** Applies a mailbox patch (`git am`) or a plain diff (`git apply`) (OG-094). */
export function applyPatch(
  path: string,
  file: string,
  mailbox: boolean,
  threeWay: boolean,
): Promise<string> {
  return invoke<string>("apply_patch", { path, file, mailbox, threeWay });
}
