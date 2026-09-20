import { beforeEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "../theme";
import { useThemeStore } from "./theme";

describe("useThemeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ preference: "system", systemDark: true, resolved: "dark" });
  });

  it("setPreference persists and resolves the theme", () => {
    useThemeStore.getState().setPreference("light");
    expect(useThemeStore.getState().preference).toBe("light");
    expect(useThemeStore.getState().resolved).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("system follows setSystemDark", () => {
    useThemeStore.getState().setPreference("system");
    useThemeStore.getState().setSystemDark(false);
    expect(useThemeStore.getState().resolved).toBe("light");
    useThemeStore.getState().setSystemDark(true);
    expect(useThemeStore.getState().resolved).toBe("dark");
  });

  it("a system change does not override an explicit preference", () => {
    useThemeStore.getState().setPreference("dark");
    useThemeStore.getState().setSystemDark(false);
    expect(useThemeStore.getState().resolved).toBe("dark");
  });
});
