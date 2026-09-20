import { describe, expect, it } from "vitest";
import { joinFolderPath } from "./paths";

describe("joinFolderPath", () => {
  it("joins with the parent separator and trims trailing slashes", () => {
    expect(joinFolderPath("/tmp/clones/", "repo")).toBe("/tmp/clones/repo");
    expect(joinFolderPath("/tmp/clones", "repo")).toBe("/tmp/clones/repo");
    expect(joinFolderPath("C:\\work", "repo")).toBe("C:\\work\\repo");
  });
});
