import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickDirectory } from "../bridge/dialog";
import { closeRepo, openRepo, recentRepos, removeRecentRepo } from "../bridge/repo";
import { statusRepo } from "../bridge/status";
import type { RepoInfo } from "../bridge/types";
import { useRepoStore } from "./repo";
import { useUiStore } from "./ui";

vi.mock("../bridge/repo", () => ({
  gitVersion: vi.fn(),
  openRepo: vi.fn(),
  recentRepos: vi.fn(),
  removeRecentRepo: vi.fn(),
  closeRepo: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../bridge/status", () => ({
  statusRepo: vi.fn().mockResolvedValue({
    head: "0123456789abcdef",
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

vi.mock("../bridge/dialog", () => ({
  pickDirectory: vi.fn(),
}));

const REPO: RepoInfo = {
  root: "/tmp/mi-repo",
  name: "mi-repo",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "0123456789abcdef",
  git_version: "2.50.1",
};

describe("useRepoStore", () => {
  beforeEach(() => {
    useRepoStore.setState({ repo: null, recents: [], openTabs: [], loading: false, error: null });
    useUiStore.setState({ outputLines: [] });
    vi.mocked(recentRepos).mockResolvedValue([]);
    vi.mocked(removeRecentRepo).mockResolvedValue(undefined);
    vi.mocked(closeRepo).mockResolvedValue(undefined);
  });

  it("opens a repository, stores it and reloads recents", async () => {
    vi.mocked(openRepo).mockResolvedValue(REPO);
    vi.mocked(recentRepos).mockResolvedValue([{ path: REPO.root, name: REPO.name, opened_at: 3 }]);

    await useRepoStore.getState().open(REPO.root);

    expect(useRepoStore.getState().repo).toEqual(REPO);
    expect(useRepoStore.getState().recents).toHaveLength(1);
    expect(useRepoStore.getState().openTabs).toEqual([
      { path: REPO.root, name: REPO.name, opened_at: expect.any(Number) },
    ]);
    expect(useRepoStore.getState().error).toBeNull();
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Repository opened: mi-repo");
    // Pending changes must be there without pressing Refresh, even in History.
    expect(statusRepo).toHaveBeenCalledWith(REPO.root);
  });

  it("appends a second repo to the tabs without reordering on switch", async () => {
    const other: RepoInfo = { ...REPO, root: "/tmp/other", name: "other" };
    vi.mocked(openRepo).mockImplementation(async (path: string) =>
      path === other.root ? other : REPO,
    );

    await useRepoStore.getState().open(REPO.root);
    await useRepoStore.getState().open(other.root);
    expect(useRepoStore.getState().openTabs.map((tab) => tab.path)).toEqual([
      REPO.root,
      other.root,
    ]);

    // Switching back focuses the tab but keeps the fixed order.
    await useRepoStore.getState().open(REPO.root);
    expect(useRepoStore.getState().repo?.root).toBe(REPO.root);
    expect(useRepoStore.getState().openTabs.map((tab) => tab.path)).toEqual([
      REPO.root,
      other.root,
    ]);
    expect(useRepoStore.getState().openTabs).toHaveLength(2);
  });

  it("closing the active tab opens the left neighbor", async () => {
    const other: RepoInfo = { ...REPO, root: "/tmp/other", name: "other" };
    vi.mocked(openRepo).mockImplementation(async (path: string) =>
      path === other.root ? other : REPO,
    );

    await useRepoStore.getState().open(REPO.root);
    await useRepoStore.getState().open(other.root);
    await useRepoStore.getState().open(REPO.root);

    await useRepoStore.getState().closeTab(REPO.root);

    expect(useRepoStore.getState().openTabs.map((tab) => tab.path)).toEqual([other.root]);
    expect(useRepoStore.getState().repo?.root).toBe(other.root);
    // Closing a tab must not erase the project from history (OG-079).
    expect(removeRecentRepo).not.toHaveBeenCalled();
  });

  it("closing the last tab returns to the empty state and keeps history", async () => {
    vi.mocked(openRepo).mockResolvedValue(REPO);
    vi.mocked(recentRepos).mockResolvedValue([{ path: REPO.root, name: REPO.name, opened_at: 1 }]);

    await useRepoStore.getState().open(REPO.root);
    await useRepoStore.getState().closeTab(REPO.root);

    expect(useRepoStore.getState().repo).toBeNull();
    expect(useRepoStore.getState().openTabs).toEqual([]);
    expect(closeRepo).toHaveBeenCalled();
    expect(useRepoStore.getState().recents.map((recent) => recent.path)).toEqual([REPO.root]);
  });

  it("removing a recent only updates history, without closing the repo or dropping tabs", async () => {
    const other = { path: "/tmp/other", name: "other", opened_at: 2 };
    vi.mocked(openRepo).mockResolvedValue(REPO);

    await useRepoStore.getState().open(REPO.root);
    useRepoStore.setState({
      recents: [{ path: REPO.root, name: REPO.name, opened_at: 1 }, other],
    });
    await useRepoStore.getState().removeRecent(other.path);

    expect(removeRecentRepo).toHaveBeenCalledWith(other.path);
    expect(useRepoStore.getState().recents.map((recent) => recent.path)).toEqual([REPO.root]);
    expect(useRepoStore.getState().repo?.root).toBe(REPO.root);
    expect(useRepoStore.getState().openTabs.map((tab) => tab.path)).toEqual([REPO.root]);
  });

  it("switches tabs cyclically in both directions", async () => {
    const repos = [
      REPO,
      { ...REPO, root: "/tmp/b", name: "b" },
      { ...REPO, root: "/tmp/c", name: "c" },
    ];
    vi.mocked(openRepo).mockImplementation(
      async (path: string) => repos.find((repo) => repo.root === path) ?? REPO,
    );

    for (const repo of repos) {
      await useRepoStore.getState().open(repo.root);
    }
    expect(useRepoStore.getState().repo?.root).toBe("/tmp/c");

    await useRepoStore.getState().switchTab(1);
    expect(useRepoStore.getState().repo?.root).toBe(REPO.root);

    await useRepoStore.getState().switchTab(-1);
    expect(useRepoStore.getState().repo?.root).toBe("/tmp/c");

    await useRepoStore.getState().switchTab(-1);
    expect(useRepoStore.getState().repo?.root).toBe("/tmp/b");
  });

  it("switching tabs is a no-op with a single tab", async () => {
    vi.mocked(openRepo).mockResolvedValue(REPO);

    await useRepoStore.getState().open(REPO.root);
    const calls = vi.mocked(openRepo).mock.calls.length;

    await useRepoStore.getState().switchTab(1);
    await useRepoStore.getState().switchTab(-1);

    expect(useRepoStore.getState().repo?.root).toBe(REPO.root);
    expect(vi.mocked(openRepo).mock.calls.length).toBe(calls);
  });

  it("translates the validation error into a readable message", async () => {
    vi.mocked(openRepo).mockRejectedValue({ kind: "not_a_repository", path: "/tmp/x" });

    await useRepoStore.getState().open("/tmp/x");

    expect(useRepoStore.getState().repo).toBeNull();
    expect(useRepoStore.getState().error).toBe("The selected folder is not a git repository");
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Could not open /tmp/x");
  });

  it("opens the picker only once while it is already open", async () => {
    let resolvePick: ((path: string | null) => void) | null = null;
    vi.mocked(pickDirectory).mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          resolvePick = resolve;
        }),
    );

    const first = useRepoStore.getState().pickAndOpen();
    const second = useRepoStore.getState().pickAndOpen();

    expect(pickDirectory).toHaveBeenCalledTimes(1);
    // The button is disabled while the picker is open.
    expect(useRepoStore.getState().loading).toBe(true);

    resolvePick!("/tmp/mi-repo");
    await Promise.all([first, second]);

    expect(openRepo).toHaveBeenCalledTimes(1);
    expect(useRepoStore.getState().loading).toBe(false);
  });

  it("clears the busy state when the picker is cancelled", async () => {
    vi.mocked(pickDirectory).mockResolvedValue(null);

    await useRepoStore.getState().pickAndOpen();

    expect(useRepoStore.getState().loading).toBe(false);
    expect(openRepo).not.toHaveBeenCalled();
  });
});
