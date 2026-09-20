import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  selectionRingColor,
  systemPrefersDark,
} from "./theme";

describe("resolveTheme", () => {
  it("system follows prefers-color-scheme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("light and dark ignore the system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("isThemePreference", () => {
  it("accepts only known values", () => {
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("neon")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});

describe("preference persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("without a saved value falls back to system", () => {
    expect(loadThemePreference()).toBe("system");
  });

  it("saves and restores the preference", () => {
    saveThemePreference("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(loadThemePreference()).toBe("light");
  });

  it("an invalid value falls back to system", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "neon");
    expect(loadThemePreference()).toBe("system");
  });
});

describe("systemPrefersDark", () => {
  it("reads the system media query", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(systemPrefersDark()).toBe(false);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(systemPrefersDark()).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe("selectionRingColor", () => {
  it("contrasts with each theme", () => {
    expect(selectionRingColor("dark")).not.toBe(selectionRingColor("light"));
  });
});
