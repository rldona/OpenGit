import { create } from "zustand";
import { pickDirectory } from "../bridge/dialog";
import { formatGitError } from "../bridge/errors";
import { closeRepo, openRepo, recentRepos, removeRecentRepo } from "../bridge/repo";
import type { RecentRepo, RepoInfo } from "../bridge/types";
import { useLogStore } from "./log";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

type RepoState = {
  repo: RepoInfo | null;
  recents: RecentRepo[];
  loading: boolean;
  error: string | null;
  loadRecents: () => Promise<void>;
  open: (path: string) => Promise<void>;
  pickAndOpen: () => Promise<void>;
  removeRecent: (path: string) => Promise<void>;
  close: () => Promise<void>;
};

function output(line: string): void {
  useUiStore.getState().appendOutput(line);
}

export const useRepoStore = create<RepoState>((set, get) => ({
  repo: null,
  recents: [],
  loading: false,
  error: null,

  loadRecents: async () => {
    try {
      set({ recents: await recentRepos() });
    } catch (error) {
      output(`Could not load recent repositories: ${formatGitError(error)}`);
    }
  },

  open: async (path) => {
    set({ loading: true, error: null });
    try {
      const info = await openRepo(path);
      set({ repo: info, loading: false });
      output(`Repository opened: ${info.name} (${info.branch ?? "detached HEAD"})`);
      await get().loadRecents();
    } catch (error) {
      const message = formatGitError(error);
      set({ loading: false, error: message });
      output(`Could not open ${path}: ${message}`);
    }
  },

  pickAndOpen: async () => {
    try {
      const path = await pickDirectory();
      if (path) {
        await get().open(path);
      }
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  removeRecent: async (path) => {
    try {
      await removeRecentRepo(path);
      await get().loadRecents();
    } catch (error) {
      output(`Could not remove from recents: ${formatGitError(error)}`);
    }
  },

  close: async () => {
    try {
      await closeRepo();
    } catch {
      // Even if it fails in Rust, the UI closes anyway.
    }
    useLogStore.getState().reset();
    useStatusStore.getState().reset();
    set({ repo: null, error: null });
    output("Repository closed");
  },
}));
