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
      set({ report: await statusRepo(root) });
    } catch (error) {
      set({ error: formatGitError(error) });
    } finally {
      set({ loading: false });
    }
  },

  /// Refresco silencioso tras el watcher: conserva filtro y selección.
  refresh: async (root) => {
    try {
      set({ root, report: await statusRepo(root) });
    } catch (error) {
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
