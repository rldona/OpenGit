import { beforeEach, describe, expect, it, vi } from "vitest";
import { blameFile } from "../bridge/blame";
import type { BlameLine } from "../bridge/types";
import { useBlameStore } from "./blame";
import { useUiStore } from "./ui";

vi.mock("../bridge/blame", () => ({
  blameFile: vi.fn(),
}));

const LINES: BlameLine[] = [
  {
    line: 1,
    hash: "a".repeat(40),
    author_name: "Ana",
    author_email: "ana@example.com",
    author_time: 1_700_000_000,
    content: "let uno = 1;",
  },
];

describe("useBlameStore", () => {
  beforeEach(() => {
    useBlameStore.getState().reset();
    useUiStore.setState({ activeView: "history" });
    vi.mocked(blameFile).mockResolvedValue(LINES);
  });

  it("opens the blame view and loads the lines", async () => {
    await useBlameStore.getState().open("/tmp/repo", "a.txt");

    expect(blameFile).toHaveBeenCalledWith("/tmp/repo", "a.txt");
    expect(useBlameStore.getState().lines).toHaveLength(1);
    expect(useBlameStore.getState().file).toBe("a.txt");
    expect(useUiStore.getState().activeView).toBe("blame");
  });

  it("keeps a readable error for an untracked file", async () => {
    vi.mocked(blameFile).mockRejectedValue({
      kind: "command_failed",
      exit_code: 128,
      stdout: "",
      stderr: "fatal: no such path 'a.txt' in HEAD",
      args: ["blame"],
    });

    await useBlameStore.getState().open("/tmp/repo", "a.txt");

    expect(useBlameStore.getState().error).toContain("no such path");
    expect(useBlameStore.getState().lines).toHaveLength(0);
    expect(useUiStore.getState().activeView).toBe("blame");
  });
});
