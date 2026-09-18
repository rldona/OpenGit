import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openRepo, submoduleStatus, worktreeList } from "../lib/bridge/repo";
import type { RepoInfo, Submodule, Worktree } from "../lib/bridge/types";
import { useExtrasStore } from "../lib/stores/extras";
import { useRepoStore } from "../lib/stores/repo";
import { ExtrasSidebar } from "./ExtrasSidebar";

vi.mock("../lib/bridge/repo", () => ({
  gitVersion: vi.fn(),
  openRepo: vi.fn(),
  recentRepos: vi.fn().mockResolvedValue([]),
  removeRecentRepo: vi.fn(),
  closeRepo: vi.fn(),
  submoduleStatus: vi.fn(),
  worktreeList: vi.fn(),
}));

const REPO: RepoInfo = {
  root: "/tmp/repo",
  name: "repo",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "aaaa",
  git_version: "2.50.1",
};

const SUBMODULES: Submodule[] = [
  { path: "vendor/lib", head: "a".repeat(40), state: "clean", describe: "heads/main" },
  { path: "vendor/otro", head: "b".repeat(40), state: "modified", describe: null },
  { path: "vendor/sin-init", head: "c".repeat(40), state: "uninitialized", describe: null },
];

const WORKTREES: Worktree[] = [
  {
    path: "/tmp/repo",
    head: "a".repeat(40),
    branch: "refs/heads/main",
    detached: false,
    bare: false,
    locked: false,
  },
  {
    path: "/tmp/wt-topic",
    head: "a".repeat(40),
    branch: "refs/heads/topic",
    detached: false,
    bare: false,
    locked: false,
  },
];

describe("ExtrasSidebar", () => {
  beforeEach(() => {
    vi.mocked(submoduleStatus).mockResolvedValue(SUBMODULES);
    vi.mocked(worktreeList).mockResolvedValue(WORKTREES);
    vi.mocked(openRepo).mockResolvedValue(REPO);
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useExtrasStore.setState({
      root: REPO.root,
      submodules: SUBMODULES,
      worktrees: WORKTREES,
      loading: false,
      error: null,
    });
  });

  it("lista submódulos con su estado y worktrees con su rama", async () => {
    render(<ExtrasSidebar />);

    expect(screen.getByRole("heading", { name: "Submodules" })).toBeInTheDocument();
    expect(screen.getByText("vendor/lib")).toBeInTheDocument();
    expect(screen.getByText("Different commit")).toBeInTheDocument();
    expect(screen.getByText("Not initialized")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Worktrees" })).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /wt-topic/ })).toBeInTheDocument();
  });

  it("marca el worktree actual y deshabilita el submódulo sin inicializar", () => {
    render(<ExtrasSidebar />);

    expect(screen.getByText("current").closest("button")).toBeDisabled();
    expect(screen.getByText("Not initialized").closest("button")).toBeDisabled();
    expect(screen.getByText("Clean").closest("button")).toBeEnabled();
  });

  it("abre el worktree y el submódulo al hacer click", async () => {
    const user = userEvent.setup();
    render(<ExtrasSidebar />);

    await user.click(screen.getByRole("button", { name: /wt-topic/ }));
    expect(openRepo).toHaveBeenCalledWith("/tmp/wt-topic");

    await user.click(screen.getByRole("button", { name: /vendor\/lib/ }));
    expect(openRepo).toHaveBeenCalledWith("/tmp/repo/vendor/lib");
  });

  it("no se muestra sin submódulos ni worktrees extra", () => {
    vi.mocked(submoduleStatus).mockResolvedValue([]);
    vi.mocked(worktreeList).mockResolvedValue([WORKTREES[0]]);
    useExtrasStore.setState({ submodules: [], worktrees: [WORKTREES[0]] });

    const { container } = render(<ExtrasSidebar />);

    expect(container).toBeEmptyDOMElement();
  });
});
