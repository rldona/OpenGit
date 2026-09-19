import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import { stashApply, stashDrop, stashList, stashPush, stashShow } from "../bridge/stash";
import type { Stash } from "../bridge/types";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

type StashState = {
  root: string | null;
  stashes: Stash[];
  loading: boolean;
  error: string | null;
  diffReference: string | null;
  diffPatch: string;
  diffLoading: boolean;
  diffError: string | null;
  load: (root: string) => Promise<void>;
  refresh: (root: string) => Promise<void>;
  create: (root: string, message: string | null, includeUntracked: boolean) => Promise<boolean>;
  apply: (root: string, reference: string) => Promise<void>;
  pop: (root: string, reference: string) => Promise<void>;
  drop: (root: string, reference: string) => Promise<void>;
  /** Loads the stash patch for the embedded view (OG-046). */
  select: (root: string, reference: string) => Promise<void>;
  clearSelection: () => void;
  reset: () => void;
};

function output(line: string): void {
  useUiStore.getState().appendOutput(line);
}

export const useStashStore = create<StashState>((set, get) => ({
  root: null,
  stashes: [],
  loading: false,
  error: null,
  diffReference: null,
  diffPatch: "",
  diffLoading: false,
  diffError: null,

  load: async (root) => {
    set({ root, loading: true, error: null });
    try {
      set({ stashes: await stashList(root), loading: false });
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  refresh: async (root) => {
    try {
      set({ root, stashes: await stashList(root) });
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  create: async (root, message, includeUntracked) => {
    set({ error: null });
    try {
      await stashPush(root, message, includeUntracked);
      output(message ? `Stash created: ${message}` : "Stash created");
      await get().refresh(root);
      await useStatusStore.getState().refresh(root);
      return true;
    } catch (error) {
      set({ error: formatGitError(error) });
      return false;
    }
  },

  apply: async (root, reference) => {
    set({ error: null });
    try {
      await stashApply(root, reference, false);
      output(`Applied ${reference}`);
      await get().refresh(root);
      await useStatusStore.getState().refresh(root);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  pop: async (root, reference) => {
    set({ error: null });
    try {
      await stashApply(root, reference, true);
      output(`Popped ${reference}`);
      // On pop (or drop) `stash@{n}` entries are renumbered: the selected
      // reference stops being reliable.
      get().clearSelection();
      await get().refresh(root);
      await useStatusStore.getState().refresh(root);
    } catch (error) {
      set({ error: formatGitError(error) });
      await get().refresh(root);
    }
  },

  drop: async (root, reference) => {
    set({ error: null });
    try {
      await stashDrop(root, reference);
      output(`Dropped ${reference}`);
      get().clearSelection();
      await get().refresh(root);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  select: async (root, reference) => {
    set({ diffReference: reference, diffPatch: "", diffLoading: true, diffError: null });
    try {
      const patch = await stashShow(root, reference);
      set({ diffPatch: patch, diffLoading: false });
    } catch (error) {
      set({ diffLoading: false, diffError: formatGitError(error) });
    }
  },

  clearSelection: () =>
    set({ diffReference: null, diffPatch: "", diffLoading: false, diffError: null }),

  reset: () =>
    set({
      root: null,
      stashes: [],
      loading: false,
      error: null,
      diffReference: null,
      diffPatch: "",
      diffLoading: false,
      diffError: null,
    }),
}));
