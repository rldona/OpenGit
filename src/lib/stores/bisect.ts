import { create } from "zustand";
import { bisectMark, bisectReset, bisectStart, bisectState } from "../bridge/bisect";
import { formatGitError } from "../bridge/errors";
import type { BisectMark, BisectState } from "../bridge/types";
import { useUiStore } from "./ui";

const IDLE: BisectState = { active: false, current: null, remaining: null };

function output(line: string): void {
  useUiStore.getState().appendOutput(line);
}

type BisectStore = {
  state: BisectState;
  error: string | null;
  load: (root: string) => Promise<void>;
  start: (root: string, bad: string | null, good: string[]) => Promise<void>;
  mark: (root: string, kind: BisectMark) => Promise<void>;
  reset: (root: string) => Promise<void>;
  resetState: () => void;
};

export const useBisectStore = create<BisectStore>((set, get) => ({
  state: IDLE,
  error: null,

  load: async (root) => {
    try {
      set({ state: await bisectState(root), error: null });
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  start: async (root, bad, good) => {
    try {
      await bisectStart(root, bad, good);
      output("Bisect started");
      await get().load(root);
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Could not start the bisect: ${message}`);
    }
  },

  mark: async (root, kind) => {
    try {
      await bisectMark(root, kind);
      output(`Bisect: marked ${kind}`);
      await get().load(root);
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Could not mark the bisect: ${message}`);
    }
  },

  reset: async (root) => {
    try {
      await bisectReset(root);
      output("Bisect reset");
      await get().load(root);
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Could not reset the bisect: ${message}`);
    }
  },

  resetState: () => set({ state: IDLE, error: null }),
}));
