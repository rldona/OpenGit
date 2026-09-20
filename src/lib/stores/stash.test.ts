import { beforeEach, describe, expect, it, vi } from "vitest";
import { statusRepo } from "../bridge/status";
import { stashApply, stashDrop, stashList, stashPush, stashShow } from "../bridge/stash";
import type { StatusReport, Stash } from "../bridge/types";
import { useStashStore } from "./stash";
import { useUiStore } from "./ui";

vi.mock("../bridge/stash", () => ({
  stashList: vi.fn(),
  stashPush: vi.fn(),
  stashApply: vi.fn(),
  stashDrop: vi.fn(),
  stashShow: vi.fn(),
}));

vi.mock("../bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

const STASHES: Stash[] = [
  {
    reference: "stash@{0}",
    subject: "WIP on main: cambios",
    timestamp: 1_789_725_600,
    hash: "abc",
  },
];

const CLEAN: StatusReport = {
  head: "a",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [],
};

describe("useStashStore", () => {
  beforeEach(() => {
    useStashStore.getState().reset();
    useUiStore.setState({ outputLines: [] });
    vi.mocked(stashList).mockResolvedValue(STASHES);
    vi.mocked(stashPush).mockResolvedValue(undefined);
    vi.mocked(stashApply).mockResolvedValue(undefined);
    vi.mocked(stashDrop).mockResolvedValue(undefined);
    vi.mocked(stashShow).mockResolvedValue("diff --git a/a.txt b/a.txt\n+dos\n");
    vi.mocked(statusRepo).mockResolvedValue(CLEAN);
  });

  it("loads the stash list", async () => {
    await useStashStore.getState().load("/tmp/repo");

    expect(useStashStore.getState().stashes).toHaveLength(1);
    expect(useStashStore.getState().stashes[0].reference).toBe("stash@{0}");
  });

  it("creates a stash with message and untracked", async () => {
    await useStashStore.getState().load("/tmp/repo");

    const ok = await useStashStore.getState().create("/tmp/repo", "mi stash", true);

    expect(ok).toBe(true);
    expect(stashPush).toHaveBeenCalledWith("/tmp/repo", "mi stash", true);
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Stash created");
    expect(statusRepo).toHaveBeenCalled();
  });

  it("pop applies with drop and refreshes", async () => {
    await useStashStore.getState().load("/tmp/repo");

    await useStashStore.getState().pop("/tmp/repo", "stash@{0}");

    expect(stashApply).toHaveBeenCalledWith("/tmp/repo", "stash@{0}", true);
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Popped stash@{0}");
  });

  it("a conflict on apply keeps the stash and exposes the error", async () => {
    vi.mocked(stashApply).mockRejectedValue({
      kind: "command_failed",
      exit_code: 1,
      stdout: "",
      stderr: "CONFLICT (content): Merge conflict in a.txt",
      args: ["stash", "pop"],
    });
    await useStashStore.getState().load("/tmp/repo");

    await useStashStore.getState().apply("/tmp/repo", "stash@{0}");

    expect(useStashStore.getState().error).toContain("CONFLICT");
    expect(stashList).toHaveBeenCalled();
  });

  it("deletes a stash", async () => {
    await useStashStore.getState().load("/tmp/repo");

    await useStashStore.getState().drop("/tmp/repo", "stash@{0}");

    expect(stashDrop).toHaveBeenCalledWith("/tmp/repo", "stash@{0}");
  });

  it("select loads the stash patch for the view", async () => {
    await useStashStore.getState().select("/tmp/repo", "stash@{0}");

    expect(stashShow).toHaveBeenCalledWith("/tmp/repo", "stash@{0}");
    expect(useStashStore.getState().diffReference).toBe("stash@{0}");
    expect(useStashStore.getState().diffPatch).toContain("+dos");
    expect(useStashStore.getState().diffLoading).toBe(false);
    expect(useStashStore.getState().diffError).toBeNull();
  });

  it("select records the error", async () => {
    vi.mocked(stashShow).mockRejectedValue(new Error("boom"));

    await useStashStore.getState().select("/tmp/repo", "stash@{0}");

    expect(useStashStore.getState().diffError).toContain("boom");
    expect(useStashStore.getState().diffLoading).toBe(false);
  });

  it("clearSelection clears the reference and the patch", async () => {
    await useStashStore.getState().select("/tmp/repo", "stash@{0}");

    useStashStore.getState().clearSelection();

    expect(useStashStore.getState().diffReference).toBeNull();
    expect(useStashStore.getState().diffPatch).toBe("");
  });

  it("pop and drop deselect: stash@{n} entries are renumbered", async () => {
    await useStashStore.getState().load("/tmp/repo");
    await useStashStore.getState().select("/tmp/repo", "stash@{0}");

    await useStashStore.getState().pop("/tmp/repo", "stash@{0}");

    expect(useStashStore.getState().diffReference).toBeNull();

    await useStashStore.getState().select("/tmp/repo", "stash@{0}");
    await useStashStore.getState().drop("/tmp/repo", "stash@{0}");

    expect(useStashStore.getState().diffReference).toBeNull();
  });
});
