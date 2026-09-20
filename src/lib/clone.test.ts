import { describe, expect, it } from "vitest";
import { cloneFolderName } from "./clone";

describe("cloneFolderName", () => {
  it("derives the folder name from the URL", () => {
    expect(cloneFolderName("https://github.com/user/repo.git")).toBe("repo");
    expect(cloneFolderName("git@github.com:user/repo.git")).toBe("repo");
    expect(cloneFolderName("https://host/a/b/")).toBe("b");
  });
});
