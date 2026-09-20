import { beforeEach, describe, expect, it } from "vitest";
import { cacheFresh, stampCheck } from "./updates";

describe("update check cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is empty before the first check", () => {
    expect(cacheFresh()).toBe(false);
  });

  it("is fresh within 24h and stale after it", () => {
    const start = 1_000_000;
    stampCheck(start);

    expect(cacheFresh(start + 60_000)).toBe(true);
    expect(cacheFresh(start + 24 * 60 * 60 * 1000 - 1)).toBe(true);
    expect(cacheFresh(start + 24 * 60 * 60 * 1000)).toBe(false);
  });
});
