import { beforeEach, describe, expect, it, vi } from "vitest";
import { cherryPick, cherryPickRange, resetTo, revertCommit } from "../bridge/history";
import { listRefs, logPage } from "../bridge/log";
import type { Commit } from "../bridge/types";
import { WORKTREE_SELECTION, useLogStore } from "./log";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

vi.mock("../bridge/log", () => ({
  logPage: vi.fn(),
  listRefs: vi.fn(),
}));

vi.mock("../bridge/history", () => ({
  cherryPick: vi.fn(),
  cherryPickRange: vi.fn(),
  revertCommit: vi.fn(),
  resetTo: vi.fn(),
}));

vi.mock("../bridge/status", () => ({
  statusRepo: vi.fn().mockResolvedValue({
    head: "a",
    branch: "main",
    detached: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    entries: [],
  }),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

vi.mock("../bridge/refs", () => ({
  branchTracking: vi
    .fn()
    .mockResolvedValue({ current: "main", upstream: null, ahead: 0, behind: 0 }),
  checkoutRef: vi.fn(),
  createBranch: vi.fn(),
  renameBranch: vi.fn(),
  deleteBranch: vi.fn(),
}));

const COMMIT: Commit = {
  hash: "aaaa0000",
  parents: [],
  author_name: "Test",
  author_email: "test@opengit.dev",
  author_time: 1_789_725_600,
  refs: ["HEAD -> main"],
  subject: "commit de prueba",
  body: "",
};

function page(size: number, prefix: string): Commit[] {
  return Array.from({ length: size }, (_, index) => ({
    ...COMMIT,
    hash: `${prefix}${index}`,
    subject: `${prefix} ${index}`,
  }));
}

describe("useLogStore", () => {
  beforeEach(() => {
    useLogStore.getState().reset();
    useStatusStore.getState().reset();
    vi.mocked(listRefs).mockResolvedValue([]);
    vi.mocked(logPage).mockResolvedValue([]);
  });

  it("loads the first page and builds the layout", async () => {
    vi.mocked(logPage).mockResolvedValue([COMMIT]);

    await useLogStore.getState().load("/tmp/repo");

    expect(useLogStore.getState().commits).toHaveLength(1);
    expect(useLogStore.getState().layout.rows).toHaveLength(1);
    expect(useLogStore.getState().hasMore).toBe(false);
    expect(logPage).toHaveBeenCalledWith("/tmp/repo", 0, 200, null, null);
  });

  it("selects the first commit when entering a project", async () => {
    vi.mocked(logPage).mockResolvedValue(page(3, "p"));

    await useLogStore.getState().load("/tmp/repo");

    expect(useLogStore.getState().selected).toBe("p0");
  });

  it("with no commits selects nothing when entering a project", async () => {
    await useLogStore.getState().load("/tmp/repo");

    expect(useLogStore.getState().selected).toBeNull();
  });

  it("preselects the uncommitted row when there are pending changes", async () => {
    useStatusStore.setState({
      report: {
        head: "aaaa0000",
        branch: "main",
        detached: false,
        upstream: null,
        ahead: 0,
        behind: 0,
        entries: [{ kind: "ordinary", xy: ".M", path: "a.txt", orig_path: null }],
      },
    });
    vi.mocked(logPage).mockResolvedValue(page(2, "p"));

    await useLogStore.getState().load("/tmp/repo");

    expect(useLogStore.getState().selected).toBe(WORKTREE_SELECTION);
  });

  it("when filtering within the same repository it does not reselect", async () => {
    vi.mocked(logPage).mockResolvedValue(page(3, "p"));
    await useLogStore.getState().load("/tmp/repo");
    useLogStore.getState().select("p2");

    await useLogStore.getState().setFilter("/tmp/repo", "refs/heads/main");

    expect(useLogStore.getState().selected).toBeNull();
  });

  it("accumulates pages and keeps the layout incremental", async () => {
    vi.mocked(logPage).mockResolvedValueOnce(page(200, "p")).mockResolvedValueOnce(page(1, "r"));

    await useLogStore.getState().load("/tmp/repo");
    expect(useLogStore.getState().hasMore).toBe(true);

    await useLogStore.getState().loadMore();

    expect(useLogStore.getState().commits).toHaveLength(201);
    expect(useLogStore.getState().layout.rows).toHaveLength(201);
    expect(useLogStore.getState().hasMore).toBe(false);
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 200, 200, null, null);
  });

  it("reloads when the branch filter changes", async () => {
    await useLogStore.getState().setFilter("/tmp/repo", "refs/heads/main");

    expect(useLogStore.getState().filter).toBe("refs/heads/main");
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, "refs/heads/main", null);
  });

  it("applies a search and passes it to the bridge", async () => {
    vi.mocked(logPage).mockResolvedValue([COMMIT]);

    await useLogStore.getState().applySearch("/tmp/repo", { grep: "fix", author: "", path: "" });

    expect(useLogStore.getState().search).toEqual({ grep: "fix", author: "", path: "" });
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, null, {
      grep: "fix",
      author: "",
      path: "",
    });
    expect(useLogStore.getState().commits).toHaveLength(1);
  });

  it("an empty search clears instead of filtering", async () => {
    await useLogStore.getState().applySearch("/tmp/repo", { grep: "  ", author: "", path: "" });

    expect(useLogStore.getState().search).toBeNull();
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, null, null);
  });

  it("clears the search when opening a different repository", async () => {
    vi.mocked(logPage).mockResolvedValue([COMMIT]);
    await useLogStore.getState().applySearch("/tmp/a", { grep: "fix", author: "", path: "" });

    await useLogStore.getState().load("/tmp/b");

    expect(useLogStore.getState().search).toBeNull();
    expect(logPage).toHaveBeenLastCalledWith("/tmp/b", 0, 200, null, null);
  });

  it("keeps the search across reload and combines it with the branch filter", async () => {
    vi.mocked(logPage).mockResolvedValue([COMMIT]);
    await useLogStore.getState().applySearch("/tmp/repo", { grep: "fix", author: "", path: "" });
    vi.mocked(logPage).mockClear();

    useLogStore.setState({ filter: "refs/heads/main" });
    await useLogStore.getState().reload("/tmp/repo");

    expect(logPage).toHaveBeenCalledWith("/tmp/repo", 0, 200, "refs/heads/main", {
      grep: "fix",
      author: "",
      path: "",
    });

    await useLogStore.getState().clearSearch("/tmp/repo");

    expect(useLogStore.getState().search).toBeNull();
    expect(useLogStore.getState().filter).toBe("refs/heads/main");
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, "refs/heads/main", null);
  });

  it("paginates with the active search", async () => {
    vi.mocked(logPage).mockResolvedValueOnce(page(200, "p")).mockResolvedValueOnce(page(1, "r"));
    await useLogStore.getState().applySearch("/tmp/repo", { grep: "fix", author: "", path: "" });

    await useLogStore.getState().loadMore();

    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 200, 200, null, {
      grep: "fix",
      author: "",
      path: "",
    });
  });

  it("flattens the graph in search mode", async () => {
    vi.mocked(logPage).mockResolvedValue([
      { ...COMMIT, hash: "bbbb0000", parents: ["aaaa0000"] },
      { ...COMMIT, hash: "aaaa0000", parents: [] },
    ]);

    await useLogStore.getState().applySearch("/tmp/repo", { grep: "fix", author: "", path: "" });

    const rows = useLogStore.getState().layout.rows;
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.lane === 0 && row.edges.length === 0)).toBe(true);
  });

  it("cherry-picks and refreshes log, refs and status", async () => {
    vi.mocked(cherryPick).mockResolvedValue(undefined);
    useUiStore.setState({ outputLines: [] });
    await useLogStore.getState().load("/tmp/repo");
    vi.mocked(logPage).mockClear();

    await useLogStore.getState().cherryPick("/tmp/repo", "abcdef1234567890");

    expect(cherryPick).toHaveBeenCalledWith("/tmp/repo", "abcdef1234567890");
    expect(logPage).toHaveBeenCalled();
    expect(listRefs).toHaveBeenCalled();
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Cherry-picked abcdef1");
  });

  it("cherry-picks a range and reports the output", async () => {
    vi.mocked(cherryPickRange).mockResolvedValue({
      conflicted: false,
      output: "Applying: f1\n",
    });
    useUiStore.setState({ outputLines: [] });
    await useLogStore.getState().load("/tmp/repo");

    await useLogStore.getState().cherryPickRange("/tmp/repo", ["aaaa", "bbbb"], true);

    expect(cherryPickRange).toHaveBeenCalledWith("/tmp/repo", ["aaaa", "bbbb"], true);
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Applying: f1");
  });

  it("reports a range cherry-pick that stops on a conflict", async () => {
    vi.mocked(cherryPickRange).mockResolvedValue({
      conflicted: true,
      output: "CONFLICT (content)\n",
    });
    useUiStore.setState({ outputLines: [] });
    await useLogStore.getState().load("/tmp/repo");

    await useLogStore.getState().cherryPickRange("/tmp/repo", ["aaaa"], false);

    expect(useUiStore.getState().outputLines.join("\n")).toContain("conflicts");
  });

  it("exposes the failure of a cherry-pick with conflicts", async () => {
    vi.mocked(cherryPick).mockRejectedValue({
      kind: "command_failed",
      exit_code: 1,
      stdout: "",
      stderr: "CONFLICT (content)",
      args: ["cherry-pick"],
    });
    await useLogStore.getState().load("/tmp/repo");

    await useLogStore.getState().cherryPick("/tmp/repo", "abcdef1234567890");

    expect(useLogStore.getState().error).toContain("CONFLICT");
  });

  it("reverts and resets with a mode", async () => {
    vi.mocked(revertCommit).mockResolvedValue(undefined);
    vi.mocked(resetTo).mockResolvedValue(undefined);
    await useLogStore.getState().load("/tmp/repo");

    await useLogStore.getState().revert("/tmp/repo", "abcdef1234567890");
    await useLogStore.getState().resetTo("/tmp/repo", "abcdef1234567890", "hard");

    expect(revertCommit).toHaveBeenCalled();
    expect(resetTo).toHaveBeenCalledWith("/tmp/repo", "abcdef1234567890", "hard");
  });

  it("exposes the git error without breaking the state", async () => {
    vi.mocked(logPage).mockRejectedValue({
      kind: "command_failed",
      exit_code: 128,
      stderr: "fatal: bad revision",
      args: ["log"],
    });

    await useLogStore.getState().load("/tmp/repo");

    expect(useLogStore.getState().error).toContain("git failed with code 128");
    expect(useLogStore.getState().commits).toHaveLength(0);
  });

  it("ignores a late log response from a previous repository", async () => {
    let resolveOld: ((commits: Commit[]) => void) | null = null;
    vi.mocked(logPage).mockImplementationOnce(
      () =>
        new Promise<Commit[]>((resolve) => {
          resolveOld = resolve;
        }),
    );
    const slow = useLogStore.getState().load("/tmp/a");

    vi.mocked(logPage).mockResolvedValueOnce(page(1, "b"));
    await useLogStore.getState().load("/tmp/b");

    resolveOld!(page(3, "a"));
    await slow;

    expect(useLogStore.getState().root).toBe("/tmp/b");
    expect(useLogStore.getState().commits.map((commit) => commit.hash)).toEqual(["b0"]);
  });

  it("shows a file history with follow and survives reload", async () => {
    vi.mocked(logPage).mockResolvedValue([COMMIT]);

    await useLogStore.getState().showFileHistory("/tmp/repo", "src/a.ts");

    expect(useLogStore.getState().historyPath).toBe("src/a.ts");
    expect(useLogStore.getState().search).toBeNull();
    expect(useUiStore.getState().activeView).toBe("history");
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, null, {
      grep: "",
      author: "",
      path: "src/a.ts",
      follow: true,
    });

    vi.mocked(logPage).mockClear();
    useLogStore.setState({ filter: "refs/heads/main" });
    await useLogStore.getState().reload("/tmp/repo");

    expect(logPage).toHaveBeenCalledWith("/tmp/repo", 0, 200, "refs/heads/main", {
      grep: "",
      author: "",
      path: "src/a.ts",
      follow: true,
    });

    await useLogStore.getState().clearFileHistory("/tmp/repo");

    expect(useLogStore.getState().historyPath).toBeNull();
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, "refs/heads/main", null);
  });

  it("a commit search clears the file history", async () => {
    await useLogStore.getState().showFileHistory("/tmp/repo", "src/a.ts");

    await useLogStore.getState().applySearch("/tmp/repo", { grep: "fix", author: "", path: "" });

    expect(useLogStore.getState().historyPath).toBeNull();
    expect(useLogStore.getState().search).toEqual({ grep: "fix", author: "", path: "" });
  });

  it("keeps at most two commits for comparison, in click order", () => {
    const { toggleCompareSelection } = useLogStore.getState();

    toggleCompareSelection("a");
    toggleCompareSelection("b");
    expect(useLogStore.getState().compareSelection).toEqual(["a", "b"]);

    toggleCompareSelection("c");
    expect(useLogStore.getState().compareSelection).toEqual(["b", "c"]);

    toggleCompareSelection("b");
    expect(useLogStore.getState().compareSelection).toEqual(["c"]);
  });
});
