import { beforeEach, describe, expect, it, vi } from "vitest";
import { openPath } from "./bridge/settings";
import { openEditor, revealInFileManager } from "./bridge/opener";
import { useUiStore } from "./stores/ui";
import { openErrorMessage, openFileEditor, revealFile, worktreePath } from "./openFiles";

vi.mock("./bridge/settings", () => ({
  openPath: vi.fn(),
}));

vi.mock("./bridge/opener", () => ({
  openExternal: vi.fn(),
  openTerminal: vi.fn(),
  revealInFileManager: vi.fn(),
  openEditor: vi.fn(),
}));

describe("openFiles", () => {
  beforeEach(() => {
    useUiStore.setState({ outputLines: [] });
    vi.mocked(openPath).mockResolvedValue(undefined);
    vi.mocked(openEditor).mockResolvedValue(undefined);
    vi.mocked(revealInFileManager).mockResolvedValue(undefined);
  });

  it("joins the root and the relative path", () => {
    expect(worktreePath("/tmp/repo", "src/a.ts")).toBe("/tmp/repo/src/a.ts");
  });

  it("prefers the backend message over the generic formatter", () => {
    expect(openErrorMessage({ kind: "invalid_output", message: "no VS Code" })).toBe("no VS Code");
    expect(openErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("reports opener failures in the output panel", async () => {
    vi.mocked(openEditor).mockRejectedValue({ kind: "invalid_output", message: "no VS Code" });

    openFileEditor("/tmp/repo", "a.txt");
    await vi.waitFor(() => {
      expect(useUiStore.getState().outputLines.join("\n")).toContain(
        "Could not open in VS Code /tmp/repo/a.txt: no VS Code",
      );
    });
    expect(openEditor).toHaveBeenCalledWith("/tmp/repo/a.txt");
  });

  it("reveals files without reporting on success", async () => {
    revealFile("/tmp/repo", "a.txt");
    await vi.waitFor(() => {
      expect(revealInFileManager).toHaveBeenCalledWith("/tmp/repo/a.txt");
    });
    expect(useUiStore.getState().outputLines).toEqual([]);
  });
});
