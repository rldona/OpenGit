import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../bridge/dialog";
import { discardPath, stagePath, statusRepo, unstagePath } from "../bridge/status";
import type { StatusReport } from "../bridge/types";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

vi.mock("../bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

vi.mock("../bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn(),
}));

const REPORT: StatusReport = {
  head: "aaaaaaaa",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [
    { kind: "ordinary", xy: ".M", path: "a.txt", orig_path: null },
    { kind: "untracked", xy: "?", path: "nuevo.txt", orig_path: null },
  ],
};

describe("useStatusStore", () => {
  beforeEach(() => {
    useStatusStore.getState().reset();
    useUiStore.setState({ outputLines: [] });
    vi.mocked(statusRepo).mockResolvedValue(REPORT);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
  });

  it("loads the working tree report", async () => {
    await useStatusStore.getState().load("/tmp/repo");

    expect(useStatusStore.getState().report?.entries).toHaveLength(2);
    expect(useStatusStore.getState().error).toBeNull();
  });

  it("stages and refreshes the status", async () => {
    await useStatusStore.getState().load("/tmp/repo");
    await useStatusStore.getState().stage("a.txt", null);

    expect(stagePath).toHaveBeenCalledWith("/tmp/repo", "a.txt", null);
    expect(statusRepo).toHaveBeenCalledTimes(2);
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Stage: a.txt");
  });

  it("discards changes and logs the action in the output", async () => {
    await useStatusStore.getState().load("/tmp/repo");
    await useStatusStore.getState().discard("a.txt", null);

    expect(discardPath).toHaveBeenCalledWith("/tmp/repo", "a.txt", null);
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Discarded: a.txt");
  });

  it("unstages staged files", async () => {
    await useStatusStore.getState().load("/tmp/repo");
    await useStatusStore.getState().unstage("a.txt", null);

    expect(unstagePath).toHaveBeenCalledWith("/tmp/repo", "a.txt", null);
  });

  it("ignores a late response from a repository that is no longer open", async () => {
    let resolveOld: ((report: StatusReport) => void) | null = null;
    vi.mocked(statusRepo).mockImplementationOnce(
      () =>
        new Promise<StatusReport>((resolve) => {
          resolveOld = resolve;
        }),
    );
    const slow = useStatusStore.getState().load("/tmp/a");

    const other: StatusReport = { ...REPORT, head: "bbbbbbbb", entries: [] };
    vi.mocked(statusRepo).mockResolvedValueOnce(other);
    await useStatusStore.getState().load("/tmp/b");

    resolveOld!(REPORT);
    await slow;

    // The stale report of /tmp/a must not overwrite /tmp/b's session.
    expect(useStatusStore.getState().root).toBe("/tmp/b");
    expect(useStatusStore.getState().report?.head).toBe("bbbbbbbb");
  });
});
