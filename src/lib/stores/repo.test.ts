import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickDirectory } from "../bridge/dialog";
import { openRepo, recentRepos } from "../bridge/repo";
import { statusRepo } from "../bridge/status";
import type { RepoInfo } from "../bridge/types";
import { useRepoStore } from "./repo";
import { useUiStore } from "./ui";

vi.mock("../bridge/repo", () => ({
  gitVersion: vi.fn(),
  openRepo: vi.fn(),
  recentRepos: vi.fn(),
  removeRecentRepo: vi.fn(),
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
    useRepoStore.setState({ repo: null, recents: [], loading: false, error: null });
    useUiStore.setState({ outputLines: [] });
    vi.mocked(recentRepos).mockResolvedValue([]);
  });

  it("opens a repository, stores it and reloads recents", async () => {
    vi.mocked(openRepo).mockResolvedValue(REPO);
    vi.mocked(recentRepos).mockResolvedValue([{ path: REPO.root, name: REPO.name, opened_at: 3 }]);

    await useRepoStore.getState().open(REPO.root);

    expect(useRepoStore.getState().repo).toEqual(REPO);
    expect(useRepoStore.getState().recents).toHaveLength(1);
    expect(useRepoStore.getState().error).toBeNull();
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Repository opened: mi-repo");
    // Pending changes must be there without pressing Refresh, even in History.
    expect(statusRepo).toHaveBeenCalledWith(REPO.root);
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
