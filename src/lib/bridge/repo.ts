import { invoke } from "@tauri-apps/api/core";
import type {
  AuthorIdent,
  GitVersion,
  GitignoreTemplate,
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

/** Creates a repository at `path`; the UI opens it afterwards (OG-086). */
export function initRepo(
  path: string,
  branch: string,
  template: string | null,
  initialCommit: boolean,
): Promise<void> {
  return invoke<void>("init_repo", { path, branch, template, initialCommit });
}

/** `.gitignore` templates offered when creating a repository. */
export function gitignoreTemplates(): Promise<GitignoreTemplate[]> {
  return invoke<GitignoreTemplate[]>("gitignore_templates");
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

/** Initializes and updates submodules (`--init --recursive`); returns git output (OG-057). */
export function submoduleUpdate(path: string, init: boolean, recursive: boolean): Promise<string> {
  return invoke<string>("submodule_update", { path, init, recursive });
}

/** Copies the `.gitmodules` URLs into the local config (OG-057). */
export function submoduleSync(path: string): Promise<string> {
  return invoke<string>("submodule_sync", { path });
}

/** Registers and clones a new submodule (OG-057). */
export function submoduleAdd(path: string, url: string, subpath: string): Promise<string> {
  return invoke<string>("submodule_add", { path, url, subpath });
}

export function worktreeList(path: string): Promise<Worktree[]> {
  return invoke<Worktree[]>("worktree_list", { path });
}

/** Creates a worktree on a new (`create`) or existing branch (OG-058). */
export function worktreeAdd(
  path: string,
  worktree: string,
  branch: string,
  create: boolean,
  startPoint: string | null,
): Promise<void> {
  return invoke<void>("worktree_add", { path, worktree, branch, create, startPoint });
}

/** Removes a worktree; `force` is only used after warning about changes (OG-058). */
export function worktreeRemove(path: string, worktree: string, force: boolean): Promise<void> {
  return invoke<void>("worktree_remove", { path, worktree, force });
}

export function lfsStatus(path: string): Promise<LfsStatus> {
  return invoke<LfsStatus>("lfs_status", { path });
}

export function remoteUrls(path: string): Promise<Remote[]> {
  return invoke<Remote[]>("remote_urls", { path });
}

/** Adds a remote (OG-056); the name is validated in the backend. */
export function remoteAdd(path: string, name: string, url: string): Promise<void> {
  return invoke<void>("remote_add", { path, name, url });
}

export function remoteSetUrl(path: string, name: string, url: string): Promise<void> {
  return invoke<void>("remote_set_url", { path, name, url });
}

export function remoteRename(path: string, oldName: string, newName: string): Promise<void> {
  return invoke<void>("remote_rename", { path, old: oldName, new: newName });
}

export function remoteRemove(path: string, name: string): Promise<void> {
  return invoke<void>("remote_remove", { path, name });
}

/** Repository git config file (`<gitdir>/config`). */
export function gitConfigPath(path: string): Promise<string> {
  return invoke<string>("git_config_path", { path });
}

/** Effective identity the commits will be signed with. */
export function authorIdent(path: string): Promise<AuthorIdent> {
  return invoke<AuthorIdent>("author_ident", { path });
}
