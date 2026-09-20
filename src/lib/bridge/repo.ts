import { invoke } from "@tauri-apps/api/core";
import type { GitVersion, RecentRepo, RepoInfo } from "./types";

export function gitVersion(): Promise<GitVersion> {
  return invoke<GitVersion>("git_version");
}

export function openRepo(path: string): Promise<RepoInfo> {
  return invoke<RepoInfo>("open_repo", { path });
}

export function recentRepos(): Promise<RecentRepo[]> {
  return invoke<RecentRepo[]>("recent_repos");
}

export function removeRecentRepo(path: string): Promise<void> {
  return invoke<void>("remove_recent_repo", { path });
}
