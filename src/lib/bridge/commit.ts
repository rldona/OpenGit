import { invoke } from "@tauri-apps/api/core";
import type { CommitResult, RepoOpState } from "./types";

export function commitMessage(path: string): Promise<string> {
  return invoke<string>("commit_message", { path });
}

export function commitRepo(path: string, message: string, amend: boolean): Promise<CommitResult> {
  return invoke<CommitResult>("commit_repo", { path, message, amend });
}

export function repoOpState(path: string): Promise<RepoOpState> {
  return invoke<RepoOpState>("repo_op_state", { path });
}
