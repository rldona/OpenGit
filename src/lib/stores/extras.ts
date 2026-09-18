import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import { submoduleStatus, worktreeList } from "../bridge/repo";
import type { Submodule, Worktree } from "../bridge/types";

type ExtrasState = {
  root: string | null;
  submodules: Submodule[];
  worktrees: Worktree[];
  loading: boolean;
  error: string | null;
  load: (root: string) => Promise<void>;
  refresh: (root: string) => Promise<void>;
  reset: () => void;
};

export const useExtrasStore = create<ExtrasState>((set) => ({
  root: null,
  submodules: [],
  worktrees: [],
  loading: false,
  error: null,

  load: async (root) => {
    set({ root, loading: true, error: null });
    try {
      const [submodules, worktrees] = await Promise.all([
        submoduleStatus(root),
        worktreeList(root),
      ]);
      set({ submodules, worktrees, loading: false });
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  refresh: async (root) => {
    try {
      const [submodules, worktrees] = await Promise.all([
        submoduleStatus(root),
        worktreeList(root),
      ]);
      set({ root, submodules, worktrees });
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  reset: () => set({ root: null, submodules: [], worktrees: [], loading: false, error: null }),
}));
