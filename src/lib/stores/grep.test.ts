import { beforeEach, describe, expect, it, vi } from "vitest";
import { grepWorktree } from "../bridge/grep";
import { useGrepStore } from "./grep";

vi.mock("../bridge/grep", () => ({
  grepWorktree: vi.fn(),
}));

describe("useGrepStore", () => {
  beforeEach(() => {
    useGrepStore.getState().reset();
    vi.mocked(grepWorktree).mockReset();
    vi.mocked(grepWorktree).mockResolvedValue({ matches: [], truncated: false });
  });

  it("does nothing with an empty pattern", async () => {
    await useGrepStore.getState().run("/tmp/repo");

    expect(grepWorktree).not.toHaveBeenCalled();
    expect(useGrepStore.getState().searched).toBe(false);
  });

  it("runs the query with the current options", async () => {
    useGrepStore.getState().setPattern("hello");
    useGrepStore.getState().setOption("caseSensitive", false);
    useGrepStore.getState().setOption("wholeWord", true);
    useGrepStore.getState().setOption("pathFilter", "src/");

    await useGrepStore.getState().run("/tmp/repo");

    expect(grepWorktree).toHaveBeenCalledWith("/tmp/repo", {
      pattern: "hello",
      case_sensitive: false,
      whole_word: true,
      regex: false,
      path: "src/",
      max_results: 200,
    });
  });

  it("stores the results and the truncation flag", async () => {
    useGrepStore.getState().setPattern("hello");
    vi.mocked(grepWorktree).mockResolvedValue({
      matches: [{ path: "a.txt", line: 1, text: "hello" }],
      truncated: true,
    });

    await useGrepStore.getState().run("/tmp/repo");

    expect(useGrepStore.getState().matches).toHaveLength(1);
    expect(useGrepStore.getState().truncated).toBe(true);
    expect(useGrepStore.getState().searched).toBe(true);
  });

  it("reports failures", async () => {
    useGrepStore.getState().setPattern("hello");
    vi.mocked(grepWorktree).mockRejectedValue(new Error("bad regex"));

    await useGrepStore.getState().run("/tmp/repo");

    expect(useGrepStore.getState().error).toContain("bad regex");
    expect(useGrepStore.getState().matches).toEqual([]);
  });
});
