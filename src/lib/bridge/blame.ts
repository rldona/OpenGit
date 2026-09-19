import { invoke } from "@tauri-apps/api/core";
import type { BlameLine } from "./types";

/** Per-line blame of a tracked file (OG-055). */
export function blameFile(path: string, file: string): Promise<BlameLine[]> {
  return invoke<BlameLine[]>("blame_file", { path, file });
}
