import { beforeEach, describe, expect, it } from "vitest";
import { clampSize, loadSize, saveSize } from "./layout";

describe("clampSize", () => {
  it("clamps to the range and tolerates non-finite values", () => {
    expect(clampSize(240, 100, 400)).toBe(240);
    expect(clampSize(50, 100, 400)).toBe(100);
    expect(clampSize(900, 100, 400)).toBe(400);
    expect(clampSize(Number.NaN, 100, 400)).toBe(100);
  });
});

describe("loadSize and saveSize", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("without a saved value returns the fallback", () => {
    expect(loadSize("test.size", 240, 100, 400)).toBe(240);
  });

  it("saves and restores the size", () => {
    saveSize("test.size", 320.6);
    expect(localStorage.getItem("test.size")).toBe("321");
    expect(loadSize("test.size", 240, 100, 400)).toBe(321);
  });

  it("a corrupt value falls back", () => {
    localStorage.setItem("test.size", "mucho");
    expect(loadSize("test.size", 240, 100, 400)).toBe(240);
  });

  it("an out-of-range value is clamped", () => {
    localStorage.setItem("test.size", "5000");
    expect(loadSize("test.size", 240, 100, 400)).toBe(400);
  });
});
