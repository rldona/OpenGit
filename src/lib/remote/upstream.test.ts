import { describe, expect, it } from "vitest";
import { splitUpstream } from "./upstream";

describe("splitUpstream", () => {
  it("splits remote and branch", () => {
    expect(splitUpstream("origin/main")).toEqual({ remote: "origin", branch: "main" });
    expect(splitUpstream("origin/feature/x")).toEqual({ remote: "origin", branch: "feature/x" });
  });

  it("returns null without an upstream or malformed input", () => {
    expect(splitUpstream(null)).toBeNull();
    expect(splitUpstream("main")).toBeNull();
    expect(splitUpstream("/main")).toBeNull();
    expect(splitUpstream("origin/")).toBeNull();
  });
});
