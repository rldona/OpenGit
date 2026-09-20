import { beforeEach, describe, expect, it, vi } from "vitest";
import { openRepo, recentRepos } from "../bridge/repo";
import type { RepoInfo } from "../bridge/types";
import { useRepoStore } from "./repo";
import { useUiStore } from "./ui";

vi.mock("../bridge/repo", () => ({
  gitVersion: vi.fn(),
  openRepo: vi.fn(),
  recentRepos: vi.fn(),
  removeRecentRepo: vi.fn(),
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
  });

  it("translates the validation error into a readable message", async () => {
    vi.mocked(openRepo).mockRejectedValue({ kind: "not_a_repository", path: "/tmp/x" });

    await useRepoStore.getState().open("/tmp/x");

    expect(useRepoStore.getState().repo).toBeNull();
    expect(useRepoStore.getState().error).toBe("The selected folder is not a git repository");
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Could not open /tmp/x");
  });
});
