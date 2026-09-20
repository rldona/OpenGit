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
  openTabs: RecentRepo[];
  loading: boolean;
  error: string | null;
  loadRecents: () => Promise<void>;
  open: (path: string) => Promise<void>;
  pickAndOpen: () => Promise<void>;
  removeRecent: (path: string) => Promise<void>;
  closeTab: (path: string) => Promise<void>;
  switchTab: (direction: 1 | -1) => Promise<void>;
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
  openTabs: [],
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
      // Session tabs keep a fixed order: append on first open, never reorder
      // on switch. The persisted recents file stays as history only.
      const tabs = get().openTabs;
      const nextTabs = tabs.some((tab) => tab.path === info.root)
        ? tabs
        : [...tabs, { path: info.root, name: info.name, opened_at: Date.now() }];
      set({ repo: info, openTabs: nextTabs, loading: false });
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
    await get().closeTab(path);
  },

  closeTab: async (path) => {
    const wasActive = get().repo?.root === path;
    const tabs = get().openTabs;
    const index = tabs.findIndex((tab) => tab.path === path);
    const remaining = tabs.filter((tab) => tab.path !== path);
    try {
      await removeRecentRepo(path);
      await get().loadRecents();
    } catch (error) {
      output(`Could not remove from recents: ${formatGitError(error)}`);
    }
    if (!wasActive) {
      set({ openTabs: remaining });
      return;
    }
    if (remaining.length === 0) {
      try {
        await closeRepo();
      } catch {
        // Even if it fails in Rust, the UI closes anyway.
      }
      useLogStore.getState().reset();
      useStatusStore.getState().reset();
      set({ repo: null, error: null, openTabs: [] });
      output("Repository closed");
      return;
    }
    // Show the tab list without the closed repo while its neighbor loads.
    set({ openTabs: remaining });
    const neighbor = index > 0 ? tabs[index - 1].path : remaining[0].path;
    await get().open(neighbor);
  },

  switchTab: async (direction) => {
    const tabs = get().openTabs;
    if (tabs.length < 2) {
      return;
    }
    const activeRoot = get().repo?.root;
    const activeIndex = tabs.findIndex((tab) => tab.path === activeRoot);
    // Unknown active repo: fall back to the first tab instead of guessing.
    const from = activeIndex < 0 ? (direction === 1 ? -1 : 0) : activeIndex;
    const next = tabs[(from + direction + tabs.length) % tabs.length];
    if (next.path !== activeRoot) {
      await get().open(next.path);
    }
  },

  close: async () => {
    const activeRoot = get().repo?.root;
    const tabs = get().openTabs;
    const remaining = activeRoot == null ? tabs : tabs.filter((tab) => tab.path !== activeRoot);
    if (remaining.length > 0 && activeRoot != null) {
      const index = tabs.findIndex((tab) => tab.path === activeRoot);
      const neighbor = index > 0 ? tabs[index - 1].path : remaining[0].path;
      set({ openTabs: remaining });
      await get().open(neighbor);
      return;
    }
    try {
      await closeRepo();
    } catch {
      // Even if it fails in Rust, the UI closes anyway.
    }
    useLogStore.getState().reset();
    useStatusStore.getState().reset();
    set({ repo: null, error: null, openTabs: remaining });
    output("Repository closed");
  },
}));
