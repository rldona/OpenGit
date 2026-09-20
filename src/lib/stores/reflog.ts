import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import { resetTo, type ResetMode } from "../bridge/history";
import { reflog as reflogRequest } from "../bridge/reflog";
import { checkoutRef, createBranch } from "../bridge/refs";
import type { ReflogEntry } from "../bridge/types";
import { useUiStore } from "./ui";

const LIMIT = 200;

function output(line: string): void {
  useUiStore.getState().appendOutput(line);
}

type ReflogState = {
  entries: ReflogEntry[];
  loading: boolean;
  error: string | null;
  load: (root: string) => Promise<void>;
  createBranchAt: (root: string, hash: string, name: string) => Promise<void>;
  checkout: (root: string, hash: string) => Promise<void>;
  reset: (root: string, hash: string, mode: ResetMode) => Promise<void>;
  resetState: () => void;
};

export const useReflogStore = create<ReflogState>((set, get) => ({
  entries: [],
  loading: false,
  error: null,

  load: async (root) => {
    set({ loading: true, error: null });
    try {
      set({ entries: await reflogRequest(root, LIMIT), loading: false });
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  createBranchAt: async (root, hash, name) => {
    try {
      await createBranch(root, name, hash);
      output(`Branch ${name} created at ${hash.slice(0, 7)}`);
      await get().load(root);
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Could not create the branch: ${message}`);
    }
  },

  checkout: async (root, hash) => {
    try {
      await checkoutRef(root, hash, false);
      output(`Checked out ${hash.slice(0, 7)}`);
      await get().load(root);
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Could not check out ${hash.slice(0, 7)}: ${message}`);
    }
  },

  reset: async (root, hash, mode) => {
    try {
      await resetTo(root, hash, mode);
      output(`Reset to ${hash.slice(0, 7)} (${mode})`);
      await get().load(root);
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Reset failed: ${message}`);
    }
  },

  resetState: () => set({ entries: [], loading: false, error: null }),
}));
