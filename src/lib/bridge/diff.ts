import { invoke } from "@tauri-apps/api/core";
import type { FileDiff } from "./types";

export type DiffRequest = {
  path: string;
  file: string;
  staged: boolean;
  rev: string | null;
  reversed: boolean;
};

export function diffFile(request: DiffRequest): Promise<string> {
  return invoke<string>("diff_file", request);
}

/** Read-only preview of an untracked file as a new-file patch (OG-071). */
export function untrackedFileDiff(path: string, file: string): Promise<string> {
  return invoke<string>("untracked_file_diff", { path, file });
}

export function commitFiles(path: string, rev: string): Promise<FileDiff[]> {
  return invoke<FileDiff[]>("commit_files", { path, rev });
}

export type ImageRequest = {
  path: string;
  file: string;
  rev: string | null;
  staged: boolean;
};

/** MIME types of the sides that exist for an image change (null if missing). */
export type ImagePair = {
  before: string | null;
  after: string | null;
};

export function imagePair(request: ImageRequest): Promise<ImagePair> {
  return invoke<ImagePair>("image_pair", request);
}

/** Raw bytes of one side; Tauri delivers an ArrayBuffer. */
export function imageBlob(
  request: ImageRequest & { side: "before" | "after" },
): Promise<ArrayBuffer> {
  return invoke<ArrayBuffer>("image_blob", request);
}

export function diffNumstat(path: string, cached: boolean): Promise<FileDiff[]> {
  return invoke<FileDiff[]>("diff_numstat", { path, cached });
}

/** Files that differ between two revisions (OG-054). */
export function compareNumstat(path: string, base: string, rev: string): Promise<FileDiff[]> {
  return invoke<FileDiff[]>("compare_numstat", { path, base, rev });
}

/** Patch of a file between two revisions (OG-054). */
export function compareFile(request: {
  path: string;
  base: string;
  rev: string;
  file: string;
  reversed: boolean;
}): Promise<string> {
  return invoke<string>("compare_file", request);
}

export type HunkSelection =
  { kind: "file" } | { kind: "hunk"; index: number } | { kind: "lines"; indices: number[] };

export function stageSelection(request: {
  path: string;
  file: string;
  staged: boolean;
  selection: HunkSelection;
  reverse: boolean;
}): Promise<void> {
  return invoke<void>("stage_selection", request);
}

/** Destructive: discards hunks/lines from the working tree (confirmed in the UI). */
export function discardSelection(request: {
  path: string;
  file: string;
  selection: HunkSelection;
}): Promise<void> {
  return invoke<void>("discard_selection", request);
}
