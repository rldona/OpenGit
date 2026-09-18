import { create } from "zustand";
import {
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  systemPrefersDark,
  type ResolvedTheme,
  type ThemePreference,
} from "../theme";

const initialPreference = loadThemePreference();
const initialSystemDark = systemPrefersDark();

type ThemeState = {
  preference: ThemePreference;
  systemDark: boolean;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  setSystemDark: (systemDark: boolean) => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initialPreference,
  systemDark: initialSystemDark,
  resolved: resolveTheme(initialPreference, initialSystemDark),
  setPreference: (preference) => {
    saveThemePreference(preference);
    set({ preference, resolved: resolveTheme(preference, get().systemDark) });
  },
  setSystemDark: (systemDark) => {
    set({ systemDark, resolved: resolveTheme(get().preference, systemDark) });
  },
}));
