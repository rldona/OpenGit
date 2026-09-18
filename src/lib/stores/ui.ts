import { create } from "zustand";

const MAX_OUTPUT_LINES = 200;

export type ViewName = "history" | "status" | "diff" | "conflict" | "rebase";

type UiState = {
  outputOpen: boolean;
  outputLines: string[];
  activeView: ViewName;
  toggleOutput: () => void;
  appendOutput: (line: string) => void;
  setActiveView: (view: ViewName) => void;
};

export const useUiStore = create<UiState>((set) => ({
  outputOpen: true,
  outputLines: ["OpenGit listo."],
  activeView: "history",
  toggleOutput: () => set((state) => ({ outputOpen: !state.outputOpen })),
  appendOutput: (line) =>
    set((state) => ({ outputLines: [...state.outputLines, line].slice(-MAX_OUTPUT_LINES) })),
  setActiveView: (view) => set({ activeView: view }),
}));
