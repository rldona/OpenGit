import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import { hooksList } from "../bridge/hooks";
import type { Hook } from "../bridge/types";

type HooksState = {
  root: string | null;
  hooks: Hook[];
  error: string | null;
  load: (root: string) => Promise<void>;
  refresh: (root: string) => Promise<void>;
  reset: () => void;
};

export const useHooksStore = create<HooksState>((set) => ({
  root: null,
  hooks: [],
  error: null,

  load: async (root) => {
    set({ root, error: null });
    try {
      set({ hooks: await hooksList(root) });
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  refresh: async (root) => {
    try {
      set({ root, hooks: await hooksList(root) });
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  reset: () => set({ root: null, hooks: [], error: null }),
}));
