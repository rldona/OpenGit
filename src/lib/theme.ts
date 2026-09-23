export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type PaletteName =
  "default" | "purple" | "classic" | "sublime" | "sublime-dark" | "github" | "copilot" | "vercel";

export const THEME_STORAGE_KEY = "opengit.theme";
export const PALETTE_STORAGE_KEY = "opengit.palette";

const PREFERENCES: ThemePreference[] = ["system", "light", "dark"];
const PALETTES: PaletteName[] = [
  "default",
  "purple",
  "classic",
  "sublime",
  "sublime-dark",
  "github",
  "copilot",
  "vercel",
];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (PREFERENCES as string[]).includes(value);
}

export function isPaletteName(value: unknown): value is PaletteName {
  return typeof value === "string" && (PALETTES as string[]).includes(value);
}

export function loadThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Without storage the preference lives only in memory.
  }
}

export function loadPalettePreference(): PaletteName {
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    return isPaletteName(stored) ? stored : "default";
  } catch {
    return "default";
  }
}

export function savePalettePreference(palette: PaletteName): void {
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  } catch {
    // Without storage the preference lives only in memory.
  }
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === "system") {
    return systemDark ? "dark" : "light";
  }
  return preference;
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : true;
}

/** Color of the graph selection ring; the canvas does not inherit CSS variables. */
export function selectionRingColor(theme: ResolvedTheme): string {
  return theme === "dark" ? "#ffffff" : "#1f2328";
}
