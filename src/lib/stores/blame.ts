import { create } from "zustand";
import { blameFile } from "../bridge/blame";
import { formatGitError } from "../bridge/errors";
import type { BlameLine } from "../bridge/types";
import { useUiStore } from "./ui";

type BlameState = {
  root: string | null;
  file: string | null;
  lines: BlameLine[];
  loading: boolean;
  error: string | null;
  open: (root: string, file: string) => Promise<void>;
  reset: () => void;
};

/** Per-line blame of a file, shown in its own view (OG-055). */
export const useBlameStore = create<BlameState>((set) => ({
  root: null,
  file: null,
  lines: [],
  loading: false,
  error: null,

  open: async (root, file) => {
    set({ root, file, lines: [], loading: true, error: null });
    useUiStore.getState().setActiveView("blame");
    try {
      const lines = await blameFile(root, file);
      set({ lines, loading: false });
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  reset: () => set({ root: null, file: null, lines: [], loading: false, error: null }),
}));
