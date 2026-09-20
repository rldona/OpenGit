import { create } from "zustand";

const MAX_OUTPUT_LINES = 200;

type UiState = {
  outputOpen: boolean;
  outputLines: string[];
  toggleOutput: () => void;
  appendOutput: (line: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  outputOpen: true,
  outputLines: ["OpenGit listo."],
  toggleOutput: () => set((state) => ({ outputOpen: !state.outputOpen })),
  appendOutput: (line) =>
    set((state) => ({ outputLines: [...state.outputLines, line].slice(-MAX_OUTPUT_LINES) })),
}));
