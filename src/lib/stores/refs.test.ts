import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../bridge/dialog";
import { listRefs, logPage } from "../bridge/log";
import {
  branchTracking,
  checkoutRef,
  deleteBranch,
  mergeBranch,
  trackingCommits,
} from "../bridge/refs";
import { worktreeList, worktreeRemove } from "../bridge/repo";
import { statusRepo } from "../bridge/status";
import type { RefEntry, StatusReport } from "../bridge/types";
import { DEFAULT_MERGE_OPTIONS } from "../merge";
import { useRefsStore } from "./refs";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

vi.mock("../bridge/refs", () => ({
  branchTracking: vi.fn(),
  trackingCommits: vi.fn(),
  checkoutRef: vi.fn(),
  createBranch: vi.fn(),
  renameBranch: vi.fn(),
  deleteBranch: vi.fn(),
  mergeBranch: vi.fn(),
}));

vi.mock("../bridge/repo", () => ({
  worktreeList: vi.fn(),
  worktreeRemove: vi.fn(),
}));

vi.mock("./extras", () => ({
  useExtrasStore: { getState: () => ({ refresh: vi.fn() }) },
}));

vi.mock("../bridge/log", () => ({
  listRefs: vi.fn(),
  logPage: vi.fn(),
}));

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

const REFS: RefEntry[] = [
  {
    name: "refs/heads/main",
    object_id: "a",
    object_type: "commit",
    upstream: null,
    track: null,
    target: "a",
  },
  {
    name: "refs/heads/feature",
    object_id: "b",
    object_type: "commit",
    upstream: "refs/remotes/origin/feature",
    track: "[ahead 1, behind 2]",
    target: "b",
  },
  {
    name: "refs/remotes/origin/remota",
    object_id: "c",
    object_type: "commit",
    upstream: null,
    track: null,
    target: "c",
  },
  {
    name: "refs/tags/v1.0.0",
    object_id: "d",
    object_type: "tag",
    upstream: null,
    track: null,
    target: "commit-d",
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

describe("useRefsStore", () => {
  beforeEach(() => {
    useRefsStore.getState().reset();
    vi.mocked(listRefs).mockResolvedValue(REFS);
    vi.mocked(branchTracking).mockResolvedValue({
      current: "main",
      upstream: null,
      ahead: 0,
      behind: 0,
    });
    vi.mocked(trackingCommits).mockResolvedValue({ incoming: [], outgoing: [] });
    vi.mocked(statusRepo).mockResolvedValue(CLEAN);
    vi.mocked(logPage).mockResolvedValue([]);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    vi.mocked(worktreeList).mockResolvedValue([]);
  });

  it("loads refs and tracking of the current branch", async () => {
    vi.mocked(branchTracking).mockResolvedValue({
      current: "main",
      upstream: "origin/main",
      ahead: 1,
      behind: 2,
    });
    vi.mocked(trackingCommits).mockResolvedValue({
      incoming: ["remoto1"],
      outgoing: ["local1"],
    });

    await useRefsStore.getState().load("/tmp/repo");

    expect(useRefsStore.getState().refs).toHaveLength(4);
    expect(useRefsStore.getState().current).toBe("main");
    expect(useRefsStore.getState().ahead).toBe(1);
    expect(useRefsStore.getState().behind).toBe(2);
    expect(trackingCommits).toHaveBeenCalledWith("/tmp/repo", "origin/main");
    expect(useRefsStore.getState().incoming).toEqual(["remoto1"]);
    expect(useRefsStore.getState().outgoing).toEqual(["local1"]);
  });

  it("without upstream does not request the commit sets", async () => {
    await useRefsStore.getState().load("/tmp/repo");

    expect(trackingCommits).not.toHaveBeenCalled();
    expect(useRefsStore.getState().incoming).toEqual([]);
    expect(useRefsStore.getState().outgoing).toEqual([]);
  });

  it("checks out a local branch", async () => {
    await useRefsStore.getState().load("/tmp/repo");
    const feature = REFS[1];

    await useRefsStore.getState().checkout("/tmp/repo", feature);

    expect(checkoutRef).toHaveBeenCalledWith("/tmp/repo", "feature", false);
  });

  it("checks out a remote creating the local branch with tracking", async () => {
    await useRefsStore.getState().load("/tmp/repo");
    const remote = REFS[2];

    await useRefsStore.getState().checkout("/tmp/repo", remote);

    expect(checkoutRef).toHaveBeenCalledWith("/tmp/repo", "origin/remota", true);
  });

  it("merges a branch into the current one and refreshes", async () => {
    vi.mocked(mergeBranch).mockResolvedValue({ conflicted: false, output: "Fast-forward\n" });
    await useRefsStore.getState().load("/tmp/repo");

    const result = await useRefsStore
      .getState()
      .merge("/tmp/repo", "feature", DEFAULT_MERGE_OPTIONS);

    expect(mergeBranch).toHaveBeenCalledWith("/tmp/repo", "feature", DEFAULT_MERGE_OPTIONS);
    expect(result?.conflicted).toBe(false);
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Merged feature");
  });

  it("flags the merge as running until it finishes", async () => {
    let resolveMerge!: (value: { conflicted: boolean; output: string }) => void;
    vi.mocked(mergeBranch).mockReturnValue(
      new Promise((resolve) => {
        resolveMerge = resolve;
      }),
    );
    await useRefsStore.getState().load("/tmp/repo");

    const pending = useRefsStore.getState().merge("/tmp/repo", "feature", DEFAULT_MERGE_OPTIONS);

    expect(useRefsStore.getState().merging).toBe(true);
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Merging feature…");

    resolveMerge({ conflicted: false, output: "" });
    await pending;

    expect(useRefsStore.getState().merging).toBe(false);
  });

  it("a merge with conflicts is not an error and is reported", async () => {
    vi.mocked(mergeBranch).mockResolvedValue({
      conflicted: true,
      output: "CONFLICT (content): Merge conflict in a.txt\n",
    });
    await useRefsStore.getState().load("/tmp/repo");

    const result = await useRefsStore
      .getState()
      .merge("/tmp/repo", "feature", { ...DEFAULT_MERGE_OPTIONS, noFf: true });

    expect(mergeBranch).toHaveBeenCalledWith("/tmp/repo", "feature", {
      ...DEFAULT_MERGE_OPTIONS,
      noFf: true,
    });
    expect(result?.conflicted).toBe(true);
    expect(useRefsStore.getState().error).toBeNull();
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Merge conflicts from feature");
  });

  it("exposes the real failure of a merge", async () => {
    vi.mocked(mergeBranch).mockRejectedValue({
      kind: "command_failed",
      exit_code: 128,
      stdout: "",
      stderr: "fatal: not something we can merge",
      args: ["merge", "otra"],
    });
    await useRefsStore.getState().load("/tmp/repo");

    const result = await useRefsStore.getState().merge("/tmp/repo", "otra", DEFAULT_MERGE_OPTIONS);

    expect(result).toBeNull();
    expect(useRefsStore.getState().error).toContain("not something we can merge");
  });

  it("warns about uncommitted changes and respects cancellation", async () => {
    useStatusStore.setState({
      report: {
        ...CLEAN,
        entries: [{ kind: "ordinary", xy: ".M", path: "a.txt", orig_path: null }],
      },
    });
    vi.mocked(confirmDestructive).mockResolvedValue(false);
    await useRefsStore.getState().load("/tmp/repo");

    await useRefsStore.getState().checkout("/tmp/repo", REFS[1]);

    expect(confirmDestructive).toHaveBeenCalled();
    expect(checkoutRef).not.toHaveBeenCalled();
  });

  it("asks to delete with force when the branch is not merged", async () => {
    vi.mocked(deleteBranch).mockRejectedValue({
      kind: "command_failed",
      exit_code: 1,
      stdout: "error: The branch 'feature' is not fully merged.",
      stderr: "",
      args: ["branch", "-d", "feature"],
    });
    await useRefsStore.getState().load("/tmp/repo");

    await useRefsStore.getState().remove("/tmp/repo", "feature");

    expect(useRefsStore.getState().pendingForceDelete).toBe("feature");
    expect(useRefsStore.getState().error).toContain("not fully merged");
  });

  it("explains a branch checked out in another worktree without calling git (OG-113)", async () => {
    vi.mocked(worktreeList).mockResolvedValue([
      {
        path: "/tmp/repo",
        head: "a",
        branch: "refs/heads/main",
        detached: false,
        bare: false,
        locked: false,
      },
      {
        path: "/tmp/wt-feature",
        head: "b",
        branch: "refs/heads/feature",
        detached: false,
        bare: false,
        locked: false,
      },
    ]);
    await useRefsStore.getState().load("/tmp/repo");

    await useRefsStore.getState().remove("/tmp/repo", "feature");

    expect(deleteBranch).not.toHaveBeenCalled();
    expect(useRefsStore.getState().error).toContain("feature");
    expect(useRefsStore.getState().error).toContain("/tmp/wt-feature");
  });

  it("removes the blocking worktree and retries the delete (OG-114)", async () => {
    const blocking = [
      {
        path: "/tmp/repo",
        head: "a",
        branch: "refs/heads/main",
        detached: false,
        bare: false,
        locked: false,
      },
      {
        path: "/tmp/wt-feature",
        head: "b",
        branch: "refs/heads/feature",
        detached: false,
        bare: false,
        locked: false,
      },
    ];
    vi.mocked(worktreeList).mockResolvedValueOnce(blocking).mockResolvedValue([blocking[0]]);
    await useRefsStore.getState().load("/tmp/repo");
    await useRefsStore.getState().remove("/tmp/repo", "feature");
    expect(useRefsStore.getState().blockingWorktree).toEqual({
      branch: "feature",
      path: "/tmp/wt-feature",
    });

    await useRefsStore.getState().removeBlockingWorktree("/tmp/repo");

    expect(worktreeRemove).toHaveBeenCalledWith("/tmp/repo", "/tmp/wt-feature", false);
    expect(deleteBranch).toHaveBeenCalledWith("/tmp/repo", "feature", false);
    expect(useRefsStore.getState().blockingWorktree).toBeNull();
  });

  it("does nothing when the worktree removal is not confirmed", async () => {
    vi.mocked(worktreeList).mockResolvedValue([
      {
        path: "/tmp/wt-feature",
        head: "b",
        branch: "refs/heads/feature",
        detached: false,
        bare: false,
        locked: false,
      },
    ]);
    await useRefsStore.getState().load("/tmp/repo");
    await useRefsStore.getState().remove("/tmp/repo", "feature");
    vi.mocked(confirmDestructive).mockResolvedValue(false);

    await useRefsStore.getState().removeBlockingWorktree("/tmp/repo");

    expect(worktreeRemove).not.toHaveBeenCalled();
    expect(deleteBranch).not.toHaveBeenCalled();
  });

  it("still asks git when the worktree lookup fails", async () => {
    vi.mocked(worktreeList).mockRejectedValue(new Error("boom"));
    await useRefsStore.getState().load("/tmp/repo");

    await useRefsStore.getState().remove("/tmp/repo", "feature");

    expect(deleteBranch).toHaveBeenCalledWith("/tmp/repo", "feature", false);
  });

  it("force delete requires typing the name", async () => {
    await useRefsStore.getState().load("/tmp/repo");

    await useRefsStore.getState().forceRemove("/tmp/repo", "feature", "otra");
    expect(deleteBranch).not.toHaveBeenCalled();

    await useRefsStore.getState().forceRemove("/tmp/repo", "feature", "feature");
    expect(deleteBranch).toHaveBeenCalledWith("/tmp/repo", "feature", true);
  });
});
