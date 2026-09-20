import { create } from "zustand";
import { pickDirectory } from "../bridge/dialog";
import { formatGitError } from "../bridge/errors";
import { closeRepo, openRepo, recentRepos, removeRecentRepo } from "../bridge/repo";
import type { RecentRepo, RepoInfo } from "../bridge/types";
import { clearStoredSession, saveStoredSession, type StoredTab, type Tab } from "../tabs";
import { useDiffStore } from "./diff";
import { useLogStore } from "./log";
import { useSettingsStore } from "./settings";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

type RepoState = {
  repo: RepoInfo | null;
  recents: RecentRepo[];
  openTabs: Tab[];
  loading: boolean;
  error: string | null;
  loadRecents: () => Promise<void>;
  open: (path: string) => Promise<void>;
  pickAndOpen: () => Promise<void>;
  removeRecent: (path: string) => Promise<void>;
  closeTab: (path: string) => Promise<void>;
  moveTab: (fromPath: string, toPath: string) => void;
  /** Sets or clears a tab's custom label (OG-108). */
  renameTab: (path: string, title: string) => void;
  switchTab: (direction: 1 | -1) => Promise<void>;
  close: () => Promise<void>;
  /** Reopens a stored session in order, leaving `active` selected (OG-082). */
  restoreSession: (entries: StoredTab[], active: string | null) => Promise<void>;
};

function output(line: string): void {
  useUiStore.getState().appendOutput(line);
}

/**
 * Persists the session only when the "reopen tabs" preference is on, so the
 * default path never writes to storage (OG-082).
 */
function persistSession(tabs: Tab[], active: string | null): void {
  if (!useSettingsStore.getState().restoreTabs) {
    return;
  }
  saveStoredSession(tabs, active);
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
      // Session tabs append on first open; switching never reorders them, only
      // dragging one onto another does (OG-107). The persisted recents file
      // stays as history only.
      const tabs = get().openTabs;
      const nextTabs = tabs.some((tab) => tab.path === info.root)
        ? tabs
        : [...tabs, { path: info.root, name: info.name, opened_at: Date.now() }];
      set({ repo: info, openTabs: nextTabs, loading: false });
      persistSession(nextTabs, info.root);
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

  // Removing a recent only touches history: it must not close the repo or
  // drop a session tab.
  removeRecent: async (path) => {
    try {
      await removeRecentRepo(path);
      set({ recents: get().recents.filter((recent) => recent.path !== path) });
    } catch (error) {
      output(`Could not remove from recents: ${formatGitError(error)}`);
    }
  },

  // Closing a tab only touches the session: the project stays in the
  // persisted recents so it remains available from the home screen.
  closeTab: async (path) => {
    const wasActive = get().repo?.root === path;
    const tabs = get().openTabs;
    const index = tabs.findIndex((tab) => tab.path === path);
    const remaining = tabs.filter((tab) => tab.path !== path);
    if (!wasActive) {
      set({ openTabs: remaining });
      persistSession(remaining, get().repo?.root ?? null);
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
      clearStoredSession();
      output("Repository closed");
      return;
    }
    // Show the tab list without the closed repo while its neighbor loads.
    set({ openTabs: remaining });
    const neighbor = index > 0 ? tabs[index - 1].path : remaining[0].path;
    await get().open(neighbor);
  },

  moveTab: (fromPath, toPath) => {
    const tabs = get().openTabs;
    const from = tabs.findIndex((tab) => tab.path === fromPath);
    const to = tabs.findIndex((tab) => tab.path === toPath);
    if (from < 0 || to < 0 || from === to) {
      return;
    }
    const next = [...tabs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    set({ openTabs: next });
    persistSession(next, get().repo?.root ?? null);
  },

  renameTab: (path, title) => {
    const tabs = get().openTabs;
    const index = tabs.findIndex((tab) => tab.path === path);
    if (index < 0) {
      return;
    }
    const trimmed = title.trim();
    const current = tabs[index];
    const nextTitle = trimmed.length > 0 ? trimmed : undefined;
    if (current.title === nextTitle) {
      return;
    }
    const next = [...tabs];
    next[index] = { ...current, title: nextTitle };
    set({ openTabs: next });
    persistSession(next, get().repo?.root ?? null);
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
    clearStoredSession();
    output("Repository closed");
  },

  restoreSession: async (entries, active) => {
    // `open` appends each tab in order and never reorders, so reopening the
    // active path last leaves it selected while keeping the stored order.
    for (const entry of entries) {
      await get().open(entry.path);
    }
    if (active !== null && get().repo?.root !== active) {
      await get().open(active);
    }
    // `open` persists without titles on every step: apply the stored labels
    // afterwards and persist again so they survive until the next change.
    const titles = new Map<string, string>();
    for (const entry of entries) {
      if (entry.title !== undefined && entry.title.length > 0) {
        titles.set(entry.path, entry.title);
      }
    }
    if (titles.size === 0) {
      return;
    }
    const tabs = get().openTabs.map((tab) => {
      const title = titles.get(tab.path);
      return title === undefined ? tab : { ...tab, title };
    });
    set({ openTabs: tabs });
    persistSession(tabs, get().repo?.root ?? null);
  },
}));
