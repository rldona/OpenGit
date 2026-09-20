import { create } from "zustand";

const MAX_OUTPUT_LINES = 200;

export type ViewName = "history" | "status" | "diff" | "conflict" | "rebase";

type UiState = {
  outputOpen: boolean;
  outputLines: string[];
  activeView: ViewName;
  shortcutsOpen: boolean;
  searchFocusRequest: number;
  fileTree: boolean;
  toggleOutput: () => void;
  appendOutput: (line: string) => void;
  setActiveView: (view: ViewName) => void;
  toggleShortcuts: () => void;
  setShortcutsOpen: (open: boolean) => void;
  requestSearchFocus: () => void;
  setFileTree: (fileTree: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  outputOpen: true,
  outputLines: ["OpenGit listo."],
  activeView: "history",
  shortcutsOpen: false,
  searchFocusRequest: 0,
  fileTree: true,
  toggleOutput: () => set((state) => ({ outputOpen: !state.outputOpen })),
  appendOutput: (line) =>
    set((state) => ({ outputLines: [...state.outputLines, line].slice(-MAX_OUTPUT_LINES) })),
  setActiveView: (view) => set({ activeView: view }),
  toggleShortcuts: () => set((state) => ({ shortcutsOpen: !state.shortcutsOpen })),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  requestSearchFocus: () => set((state) => ({ searchFocusRequest: state.searchFocusRequest + 1 })),
  setFileTree: (fileTree) => set({ fileTree }),
}));
