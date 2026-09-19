import { describe, expect, it } from "vitest";
import { isNewer, parseVersion } from "./updates";

describe("parseVersion", () => {
  it("parses plain and v-prefixed versions", () => {
    expect(parseVersion("0.3.1")).toEqual([0, 3, 1]);
    expect(parseVersion("v0.3.1")).toEqual([0, 3, 1]);
    expect(parseVersion("  v10.0.2  ")).toEqual([10, 0, 2]);
  });

  it("rejects non-versions", () => {
    expect(parseVersion("main")).toBeNull();
    expect(parseVersion("0.3")).toBeNull();
    expect(parseVersion("")).toBeNull();
  });

  it("ignores prerelease suffixes", () => {
    expect(parseVersion("v0.3.1-beta")).toEqual([0, 3, 1]);
  });
});

describe("isNewer", () => {
  it("compares release tags against the running version", () => {
    expect(isNewer("0.3.1", "v0.3.2")).toBe(true);
    expect(isNewer("0.3.1", "v0.4.0")).toBe(true);
    expect(isNewer("0.3.1", "v1.0.0")).toBe(true);
    expect(isNewer("0.3.2", "v0.3.2")).toBe(false);
    expect(isNewer("0.4.0", "v0.3.9")).toBe(false);
    expect(isNewer("0.3.1", "v0.3.1")).toBe(false);
  });

  it("never notifies on unparsable versions", () => {
    expect(isNewer("0.3.1", "nightly")).toBe(false);
    expect(isNewer("dev", "v0.3.2")).toBe(false);
  });
});
