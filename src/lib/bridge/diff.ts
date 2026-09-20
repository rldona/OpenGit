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

export function commitFiles(path: string, rev: string): Promise<FileDiff[]> {
  return invoke<FileDiff[]>("commit_files", { path, rev });
}

export function diffNumstat(path: string, cached: boolean): Promise<FileDiff[]> {
  return invoke<FileDiff[]>("diff_numstat", { path, cached });
}
