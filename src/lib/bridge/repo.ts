import { invoke } from "@tauri-apps/api/core";
import type {
  AuthorIdent,
  GitVersion,
  LfsStatus,
  RecentRepo,
  Remote,
  RepoInfo,
  Submodule,
  Worktree,
} from "./types";

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

/** Stops the watcher of the open repo. */
export function closeRepo(): Promise<void> {
  return invoke<void>("close_repo");
}

export function submoduleStatus(path: string): Promise<Submodule[]> {
  return invoke<Submodule[]>("submodule_status", { path });
}

export function worktreeList(path: string): Promise<Worktree[]> {
  return invoke<Worktree[]>("worktree_list", { path });
}

export function lfsStatus(path: string): Promise<LfsStatus> {
  return invoke<LfsStatus>("lfs_status", { path });
}

export function remoteUrls(path: string): Promise<Remote[]> {
  return invoke<Remote[]>("remote_urls", { path });
}

/** Effective identity the commits will be signed with. */
export function authorIdent(path: string): Promise<AuthorIdent> {
  return invoke<AuthorIdent>("author_ident", { path });
}
