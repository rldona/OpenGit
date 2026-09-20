import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import { grepWorktree } from "../bridge/grep";
import type { GrepMatch } from "../bridge/types";

export type GrepOption = "caseSensitive" | "wholeWord" | "regex" | "pathFilter";

type GrepState = {
  pattern: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  pathFilter: string;
  matches: GrepMatch[];
  truncated: boolean;
  running: boolean;
  /** A search has been run (even if it returned nothing). */
  searched: boolean;
  error: string | null;
  setPattern: (pattern: string) => void;
  setOption: (key: GrepOption, value: boolean | string) => void;
  /** Runs the current query against the working tree. */
  run: (root: string) => Promise<void>;
  reset: () => void;
};

export const useGrepStore = create<GrepState>((set, get) => ({
  pattern: "",
  caseSensitive: true,
  wholeWord: false,
  regex: false,
  pathFilter: "",
  matches: [],
  truncated: false,
  running: false,
  searched: false,
  error: null,

  setPattern: (pattern) => set({ pattern }),
  setOption: (key, value) => set({ [key]: value } as Partial<GrepState>),

  run: async (root) => {
    const { pattern, caseSensitive, wholeWord, regex, pathFilter } = get();
    if (pattern === "") {
      set({ matches: [], truncated: false, searched: false, error: null });
      return;
    }
    set({ running: true, error: null });
    try {
      const result = await grepWorktree(root, {
        pattern,
        case_sensitive: caseSensitive,
        whole_word: wholeWord,
        regex,
        path: pathFilter.trim() === "" ? null : pathFilter.trim(),
        max_results: 200,
      });
      set({
        matches: result.matches,
        truncated: result.truncated,
        running: false,
        searched: true,
      });
    } catch (error) {
      set({ running: false, searched: true, matches: [], error: formatGitError(error) });
    }
  },

  reset: () =>
    set({
      pattern: "",
      caseSensitive: true,
      wholeWord: false,
      regex: false,
      pathFilter: "",
      matches: [],
      truncated: false,
      running: false,
      searched: false,
      error: null,
    }),
}));
