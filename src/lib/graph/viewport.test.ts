import { describe, expect, it } from "vitest";
import { ROW_HEIGHT } from "./layout";
import { sameRange, visibleRange } from "./viewport";

describe("visibleRange", () => {
  it("covers the viewport with overscan", () => {
    const range = visibleRange(0, ROW_HEIGHT * 10, 1000, 6);
    expect(range).toEqual({ start: 0, end: 16 });
  });

  it("advances on scroll", () => {
    const range = visibleRange(ROW_HEIGHT * 50, ROW_HEIGHT * 10, 1000, 6);
    expect(range).toEqual({ start: 44, end: 66 });
  });

  it("clips at the end of the list", () => {
    const range = visibleRange(ROW_HEIGHT * 999, ROW_HEIGHT * 10, 1000, 6);
    expect(range.end).toBe(1000);
  });

  it("does not return negative values", () => {
    expect(visibleRange(0, 0, 0)).toEqual({ start: 0, end: 0 });
  });

  it("detects equal ranges", () => {
    expect(sameRange({ start: 1, end: 2 }, { start: 1, end: 2 })).toBe(true);
    expect(sameRange({ start: 1, end: 2 }, { start: 1, end: 3 })).toBe(false);
  });
});
