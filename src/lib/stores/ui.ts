import { create } from "zustand";

const MAX_OUTPUT_LINES = 200;

export type ViewName = "history" | "status" | "diff" | "conflict" | "rebase" | "stash" | "blame";

type UiState = {
  outputOpen: boolean;
  outputLines: string[];
  activeView: ViewName;
  shortcutsOpen: boolean;
  newBranchRequest: number;
  newStashRequest: number;
  /** Incremented to focus the history search field (mod+f). */
  searchFocusRequest: number;
  fileTree: boolean;
  toggleOutput: () => void;
  appendOutput: (line: string) => void;
  setActiveView: (view: ViewName) => void;
  toggleShortcuts: () => void;
  setShortcutsOpen: (open: boolean) => void;
  requestNewBranch: () => void;
  requestNewStash: () => void;
  requestSearchFocus: () => void;
  setFileTree: (fileTree: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  outputOpen: false,
  outputLines: ["OpenGit listo."],
  activeView: "history",
  shortcutsOpen: false,
  newBranchRequest: 0,
  newStashRequest: 0,
  searchFocusRequest: 0,
  fileTree: false,
  toggleOutput: () => set((state) => ({ outputOpen: !state.outputOpen })),
  appendOutput: (line) =>
    set((state) => ({ outputLines: [...state.outputLines, line].slice(-MAX_OUTPUT_LINES) })),
  setActiveView: (view) => set({ activeView: view }),
  toggleShortcuts: () => set((state) => ({ shortcutsOpen: !state.shortcutsOpen })),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  requestNewBranch: () => set((state) => ({ newBranchRequest: state.newBranchRequest + 1 })),
  requestNewStash: () => set((state) => ({ newStashRequest: state.newStashRequest + 1 })),
  requestSearchFocus: () => set((state) => ({ searchFocusRequest: state.searchFocusRequest + 1 })),
  setFileTree: (fileTree) => set({ fileTree }),
}));
