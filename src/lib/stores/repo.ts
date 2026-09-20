import { create } from "zustand";
import { pickDirectory } from "../bridge/dialog";
import { formatGitError } from "../bridge/errors";
import { closeRepo, openRepo, recentRepos, removeRecentRepo } from "../bridge/repo";
import type { RecentRepo, RepoInfo } from "../bridge/types";
import { useDiffStore } from "./diff";
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

/**
 * Guards the open flow against re-entrancy. `pickAndOpen`/`open` are async and
 * the native picker (or a slow repo) leaves the UI clickable; without this, a
 * second click launched the picker again and the dialog showed up several times.
 */
let picking = false;
let opening = false;

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
    if (opening) {
      return;
    }
    opening = true;
    set({ loading: true, error: null });
    try {
      const info = await openRepo(path);
      // Load the working tree status before rendering the repo: the history
      // uses it to preselect the "Uncommitted changes" row with its panels.
      await useStatusStore.getState().load(info.root);
      // Drop the previous repository's diff: without this, its files and patch
      // were briefly rendered under the new repo while the new one loaded.
      useDiffStore.getState().reset();
      set({ repo: info, loading: false });
      output(`Repository opened: ${info.name} (${info.branch ?? "detached HEAD"})`);
      await get().loadRecents();
    } catch (error) {
      const message = formatGitError(error);
      set({ loading: false, error: message });
      output(`Could not open ${path}: ${message}`);
    } finally {
      opening = false;
    }
  },

  pickAndOpen: async () => {
    if (picking) {
      return;
    }
    picking = true;
    // Mark the UI busy before the native picker opens: otherwise the button
    // stays enabled while it is open and every click launches another dialog.
    set({ loading: true, error: null });
    try {
      const path = await pickDirectory();
      if (path) {
        await get().open(path);
        return;
      }
      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    } finally {
      picking = false;
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
