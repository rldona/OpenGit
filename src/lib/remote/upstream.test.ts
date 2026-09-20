import { describe, expect, it } from "vitest";
import { splitUpstream } from "./upstream";

describe("splitUpstream", () => {
  it("separa remoto y rama", () => {
    expect(splitUpstream("origin/main")).toEqual({ remote: "origin", branch: "main" });
    expect(splitUpstream("origin/feature/x")).toEqual({ remote: "origin", branch: "feature/x" });
  });

  it("sin upstream o malformado devuelve null", () => {
    expect(splitUpstream(null)).toBeNull();
    expect(splitUpstream("main")).toBeNull();
    expect(splitUpstream("/main")).toBeNull();
    expect(splitUpstream("origin/")).toBeNull();
  });
});
