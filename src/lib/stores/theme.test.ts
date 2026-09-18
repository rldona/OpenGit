import { beforeEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "../theme";
import { useThemeStore } from "./theme";

describe("useThemeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ preference: "system", systemDark: true, resolved: "dark" });
  });

  it("setPreference persiste y resuelve el tema", () => {
    useThemeStore.getState().setPreference("light");
    expect(useThemeStore.getState().preference).toBe("light");
    expect(useThemeStore.getState().resolved).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("system sigue a setSystemDark", () => {
    useThemeStore.getState().setPreference("system");
    useThemeStore.getState().setSystemDark(false);
    expect(useThemeStore.getState().resolved).toBe("light");
    useThemeStore.getState().setSystemDark(true);
    expect(useThemeStore.getState().resolved).toBe("dark");
  });

  it("un cambio del sistema no pisa una preferencia explícita", () => {
    useThemeStore.getState().setPreference("dark");
    useThemeStore.getState().setSystemDark(false);
    expect(useThemeStore.getState().resolved).toBe("dark");
  });
});
