import { beforeEach, describe, expect, it } from "vitest";
import {
  PALETTE_STORAGE_KEY,
  isPaletteName,
  loadPalettePreference,
  savePalettePreference,
} from "../theme";
import { usePaletteStore } from "./palette";

describe("isPaletteName", () => {
  it("accepts only known values", () => {
    expect(isPaletteName("default")).toBe(true);
    expect(isPaletteName("purple")).toBe(true);
    expect(isPaletteName("sublime-dark")).toBe(true);
    expect(isPaletteName("code")).toBe(true);
    expect(isPaletteName("neon")).toBe(false);
    expect(isPaletteName(null)).toBe(false);
  });
});

describe("palette preference persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("without a saved value falls back to default", () => {
    expect(loadPalettePreference()).toBe("default");
  });

  it("saves and restores the palette", () => {
    savePalettePreference("copilot");
    expect(localStorage.getItem(PALETTE_STORAGE_KEY)).toBe("copilot");
    expect(loadPalettePreference()).toBe("copilot");
  });

  it("an invalid value falls back to default", () => {
    localStorage.setItem(PALETTE_STORAGE_KEY, "neon");
    expect(loadPalettePreference()).toBe("default");
  });
});

describe("usePaletteStore", () => {
  beforeEach(() => {
    localStorage.clear();
    usePaletteStore.setState({ palette: "default" });
  });

  it("starts on the default palette", () => {
    expect(usePaletteStore.getState().palette).toBe("default");
  });

  it("setPalette persists the palette", () => {
    usePaletteStore.getState().setPalette("vercel");
    expect(usePaletteStore.getState().palette).toBe("vercel");
    expect(localStorage.getItem(PALETTE_STORAGE_KEY)).toBe("vercel");
  });
});
