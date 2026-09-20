import { invoke } from "@tauri-apps/api/core";
import type { BisectMark, BisectState } from "./types";

/** Starts a bisect with an optional bad commit and good ones (OG-090). */
export function bisectStart(path: string, bad: string | null, good: string[]): Promise<void> {
  return invoke<void>("bisect_start", { path, bad, good });
}

/** Marks the current bisect candidate (OG-090). */
export function bisectMark(path: string, kind: BisectMark): Promise<void> {
  return invoke<void>("bisect_mark", { path, kind });
}

/** Ends the bisect (OG-090). */
export function bisectReset(path: string): Promise<void> {
  return invoke<void>("bisect_reset", { path });
}

/** Reads the bisect state (OG-090). */
export function bisectState(path: string): Promise<BisectState> {
  return invoke<BisectState>("bisect_state", { path });
}
