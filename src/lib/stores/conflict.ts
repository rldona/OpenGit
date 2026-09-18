import { create } from "zustand";
import { readConflictFile, resolveConflict } from "../bridge/conflict";
import { formatGitError } from "../bridge/errors";
import {
  conflictCount,
  parseConflictBlocks,
  resolvedContent,
  type ConflictBlock,
  type ConflictChoice,
} from "../conflict/parse";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

type ConflictState = {
  root: string | null;
  file: string | null;
  blocks: ConflictBlock[];
  choices: Record<number, ConflictChoice>;
  binary: boolean;
  loading: boolean;
  error: string | null;
  open: (root: string, file: string) => Promise<void>;
  choose: (index: number, choice: ConflictChoice) => void;
  undecide: (index: number) => void;
  save: (root: string) => Promise<boolean>;
  reset: () => void;
};

export const useConflictStore = create<ConflictState>((set, get) => ({
  root: null,
  file: null,
  blocks: [],
  choices: {},
  binary: false,
  loading: false,
  error: null,

  open: async (root, file) => {
    set({ root, file, loading: true, error: null, choices: {} });
    try {
      const result = await readConflictFile(root, file);
      set({
        blocks: result.binary ? [] : parseConflictBlocks(result.content),
        binary: result.binary,
        loading: false,
      });
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  choose: (index, choice) => set((state) => ({ choices: { ...state.choices, [index]: choice } })),

  undecide: (index) =>
    set((state) => {
      const choices = { ...state.choices };
      delete choices[index];
      return { choices };
    }),

  save: async (root) => {
    const { file, blocks, choices } = get();
    if (!file) {
      return false;
    }
    const total = conflictCount(blocks);
    if (total === 0) {
      set({ error: "No conflict markers found: resolve this file outside the app" });
      return false;
    }
    const { content, unresolved } = resolvedContent(blocks, choices);
    if (unresolved > 0) {
      set({ error: `Resolve all blocks before saving (${unresolved} left)` });
      return false;
    }
    set({ loading: true, error: null });
    try {
      await resolveConflict(root, file, content);
      useUiStore.getState().appendOutput(`Resolved ${file}`);
      set({ loading: false, choices: {} });
      await useStatusStore.getState().refresh(root);
      const remaining =
        useStatusStore.getState().report?.entries.filter((entry) => entry.kind === "unmerged")
          .length ?? 0;
      if (remaining === 0) {
        useUiStore.getState().appendOutput("All conflicts resolved — use Continue in the banner");
      }
      return true;
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
      return false;
    }
  },

  reset: () =>
    set({
      root: null,
      file: null,
      blocks: [],
      choices: {},
      binary: false,
      loading: false,
      error: null,
    }),
}));
