import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import { lfsStatus, submoduleStatus, worktreeList } from "../bridge/repo";
import type { LfsStatus, Submodule, Worktree } from "../bridge/types";

type ExtrasState = {
  root: string | null;
  submodules: Submodule[];
  worktrees: Worktree[];
  lfs: LfsStatus | null;
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
  lfs: null,
  loading: false,
  error: null,

  load: async (root) => {
    set({ root, loading: true, error: null });
    try {
      const [submodules, worktrees, lfs] = await Promise.all([
        submoduleStatus(root),
        worktreeList(root),
        lfsStatus(root),
      ]);
      set({ submodules, worktrees, lfs, loading: false });
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  refresh: async (root) => {
    try {
      const [submodules, worktrees, lfs] = await Promise.all([
        submoduleStatus(root),
        worktreeList(root),
        lfsStatus(root),
      ]);
      set({ root, submodules, worktrees, lfs });
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  reset: () =>
    set({ root: null, submodules: [], worktrees: [], lfs: null, loading: false, error: null }),
}));
