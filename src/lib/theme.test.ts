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
  it("system sigue a prefers-color-scheme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("light y dark ignoran el sistema", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("isThemePreference", () => {
  it("acepta solo los valores conocidos", () => {
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("neon")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});

describe("persistencia de la preferencia", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sin valor guardado cae en system", () => {
    expect(loadThemePreference()).toBe("system");
  });

  it("guarda y recupera la preferencia", () => {
    saveThemePreference("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(loadThemePreference()).toBe("light");
  });

  it("un valor inválido cae en system", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "neon");
    expect(loadThemePreference()).toBe("system");
  });
});

describe("systemPrefersDark", () => {
  it("lee la media query del sistema", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(systemPrefersDark()).toBe(false);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(systemPrefersDark()).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe("selectionRingColor", () => {
  it("contrasta con cada tema", () => {
    expect(selectionRingColor("dark")).not.toBe(selectionRingColor("light"));
  });
});
