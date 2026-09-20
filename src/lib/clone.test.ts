import { describe, expect, it } from "vitest";
import { cloneFolderName, joinClonePath } from "./clone";

describe("clone helpers", () => {
  it("derives the folder name from the URL", () => {
    expect(cloneFolderName("https://github.com/user/repo.git")).toBe("repo");
    expect(cloneFolderName("git@github.com:user/repo.git")).toBe("repo");
    expect(cloneFolderName("https://host/a/b/")).toBe("b");
  });

  it("joins paths with the parent separator", () => {
    expect(joinClonePath("/tmp/clones/", "repo")).toBe("/tmp/clones/repo");
    expect(joinClonePath("C:\\work", "repo")).toBe("C:\\work\\repo");
  });
});
