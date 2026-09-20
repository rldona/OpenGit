import { beforeEach, describe, expect, it } from "vitest";
import { clampSize, loadSize, saveSize } from "./layout";

describe("clampSize", () => {
  it("limita al rango y tolera valores no finitos", () => {
    expect(clampSize(240, 100, 400)).toBe(240);
    expect(clampSize(50, 100, 400)).toBe(100);
    expect(clampSize(900, 100, 400)).toBe(400);
    expect(clampSize(Number.NaN, 100, 400)).toBe(100);
  });
});

describe("loadSize y saveSize", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sin valor guardado devuelve el fallback", () => {
    expect(loadSize("test.size", 240, 100, 400)).toBe(240);
  });

  it("guarda y recupera el tamaño", () => {
    saveSize("test.size", 320.6);
    expect(localStorage.getItem("test.size")).toBe("321");
    expect(loadSize("test.size", 240, 100, 400)).toBe(321);
  });

  it("un valor corrupto cae al fallback", () => {
    localStorage.setItem("test.size", "mucho");
    expect(loadSize("test.size", 240, 100, 400)).toBe(240);
  });

  it("un valor fuera de rango se limita", () => {
    localStorage.setItem("test.size", "5000");
    expect(loadSize("test.size", 240, 100, 400)).toBe(400);
  });
});
