import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import { deleteUntracked, discardPath, stagePath, statusRepo, unstagePath } from "../bridge/status";
import type { StatusReport } from "../bridge/types";
import { useUiStore } from "./ui";

type StatusState = {
  root: string | null;
  report: StatusReport | null;
  filter: string;
  selected: string | null;
  loading: boolean;
  error: string | null;
  load: (root: string) => Promise<void>;
  refresh: (root: string) => Promise<void>;
  setFilter: (filter: string) => void;
  select: (path: string | null) => void;
  stage: (file: string, origFile: string | null) => Promise<void>;
  unstage: (file: string, origFile: string | null) => Promise<void>;
  stageMany: (files: Array<{ path: string; orig_path: string | null }>) => Promise<void>;
  unstageMany: (files: Array<{ path: string; orig_path: string | null }>) => Promise<void>;
  discard: (file: string, origFile: string | null) => Promise<void>;
  removeUntracked: (file: string) => Promise<void>;
  reset: () => void;
};

function output(line: string): void {
  useUiStore.getState().appendOutput(line);
}

export const useStatusStore = create<StatusState>((set, get) => ({
  root: null,
  report: null,
  filter: "",
  selected: null,
  loading: false,
  error: null,

  load: async (root) => {
    set({ root, loading: true, error: null });
    try {
      const report = await statusRepo(root);
      // Another repository may have been opened while this was in flight.
      if (get().root !== root) return;
      set({ report });
    } catch (error) {
      if (get().root !== root) return;
      set({ error: formatGitError(error) });
    } finally {
      if (get().root === root) {
        set({ loading: false });
      }
    }
  },

  /// Silent refresh after the watcher: keeps filter and selection.
  refresh: async (root) => {
    // Refresh of a repository that is no longer (or not yet) the open one is
    // ignored, so a late response cannot overwrite the current session.
    const current = get().root;
    if (current !== null && current !== root) return;
    try {
      const report = await statusRepo(root);
      const now = get().root;
      if (now !== null && now !== root) return;
      set({ root, report });
    } catch (error) {
      const now = get().root;
      if (now !== null && now !== root) return;
      set({ error: formatGitError(error) });
    }
  },

  setFilter: (filter) => set({ filter }),
  select: (path) => set({ selected: path }),

  stage: async (file, origFile) => {
    const { root } = get();
    if (!root) return;
    try {
      await stagePath(root, file, origFile);
      output(`Stage: ${file}`);
      await get().refresh(root);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  unstage: async (file, origFile) => {
    const { root } = get();
    if (!root) return;
    try {
      await unstagePath(root, file, origFile);
      output(`Unstage: ${file}`);
      await get().refresh(root);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  stageMany: async (files) => {
    const { root } = get();
    if (!root || files.length === 0) return;
    try {
      for (const file of files) {
        await stagePath(root, file.path, file.orig_path);
      }
      output(`Staged ${files.length} file(s)`);
      await get().refresh(root);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  unstageMany: async (files) => {
    const { root } = get();
    if (!root || files.length === 0) return;
    try {
      for (const file of files) {
        await unstagePath(root, file.path, file.orig_path);
      }
      output(`Unstaged ${files.length} file(s)`);
      await get().refresh(root);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  discard: async (file, origFile) => {
    const { root } = get();
    if (!root) return;
    try {
      await discardPath(root, file, origFile);
      output(`Discarded: ${file}`);
      await get().refresh(root);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  removeUntracked: async (file) => {
    const { root } = get();
    if (!root) return;
    try {
      await deleteUntracked(root, file);
      output(`Deleted: ${file}`);
      await get().refresh(root);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  reset: () =>
    set({
      root: null,
      report: null,
      filter: "",
      selected: null,
      loading: false,
      error: null,
    }),
}));
