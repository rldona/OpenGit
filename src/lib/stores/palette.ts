import { create } from "zustand";
import { loadPalettePreference, savePalettePreference, type PaletteName } from "../theme";

type PaletteState = {
  palette: PaletteName;
  setPalette: (palette: PaletteName) => void;
};

export const usePaletteStore = create<PaletteState>((set) => ({
  palette: loadPalettePreference(),
  setPalette: (palette) => {
    savePalettePreference(palette);
    set({ palette });
  },
}));
