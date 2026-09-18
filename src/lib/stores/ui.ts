import { create } from "zustand";

type UiState = {
  outputOpen: boolean;
  toggleOutput: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  outputOpen: true,
  toggleOutput: () => set((state) => ({ outputOpen: !state.outputOpen })),
}));
