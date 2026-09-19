import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import {
  lfsStatus,
  openRepo,
  remoteUrls,
  submoduleStatus,
  submoduleSync,
  submoduleUpdate,
  worktreeAdd,
  worktreeList,
  worktreeRemove,
} from "../lib/bridge/repo";
import type { LfsStatus, RepoInfo, Submodule, Worktree } from "../lib/bridge/types";
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
  submoduleUpdate: vi.fn().mockResolvedValue(""),
  submoduleSync: vi.fn().mockResolvedValue(""),
  submoduleAdd: vi.fn().mockResolvedValue(""),
  worktreeList: vi.fn(),
  worktreeAdd: vi.fn().mockResolvedValue(undefined),
  worktreeRemove: vi.fn().mockResolvedValue(undefined),
  lfsStatus: vi.fn(),
  remoteUrls: vi.fn(),
}));

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn().mockResolvedValue(true),
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

const LFS: LfsStatus = { installed: true, version: "git-lfs/3.5.1", configured: true };

describe("ExtrasSidebar", () => {
  beforeEach(() => {
    vi.mocked(submoduleStatus).mockResolvedValue(SUBMODULES);
    vi.mocked(worktreeList).mockResolvedValue(WORKTREES);
    vi.mocked(lfsStatus).mockResolvedValue(LFS);
    vi.mocked(remoteUrls).mockResolvedValue([]);
    vi.mocked(openRepo).mockResolvedValue(REPO);
    useRepoStore.setState({ repo: REPO, recents: [], openTabs: [], loading: false, error: null });
    useExtrasStore.setState({
      root: REPO.root,
      submodules: SUBMODULES,
      worktrees: WORKTREES,
      lfs: LFS,
      loading: false,
      error: null,
    });
  });

  it("lists submodules with their state and worktrees with their branch", async () => {
    render(<ExtrasSidebar />);

    expect(screen.getByRole("button", { name: "Submodules" })).toBeInTheDocument();
    expect(screen.getByText("vendor/lib")).toBeInTheDocument();
    expect(screen.getByText("Different commit")).toBeInTheDocument();
    expect(screen.getByText("Not initialized")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Worktrees" })).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /wt-topic/ })).toBeInTheDocument();
  });

  it("marks the current worktree and disables the uninitialized submodule", () => {
    render(<ExtrasSidebar />);

    expect(screen.getByText("current").closest("button")).toBeDisabled();
    expect(screen.getByText("Not initialized").closest("button")).toBeDisabled();
    expect(screen.getByText("Clean").closest("button")).toBeEnabled();
  });

  it("opens the worktree and the submodule on click", async () => {
    const user = userEvent.setup();
    render(<ExtrasSidebar />);

    await user.click(screen.getByRole("button", { name: /wt-topic/ }));
    expect(openRepo).toHaveBeenCalledWith("/tmp/wt-topic");

    await user.click(screen.getByRole("button", { name: /vendor\/lib/ }));
    expect(openRepo).toHaveBeenCalledWith("/tmp/repo/vendor/lib");
  });

  it("initializes an uninitialized submodule with the prominent action", async () => {
    const user = userEvent.setup();
    render(<ExtrasSidebar />);

    await user.click(screen.getByRole("button", { name: "Update" }));

    expect(submoduleUpdate).toHaveBeenCalledWith("/tmp/repo", true, true);
  });

  it("syncs a submodule from its context menu", async () => {
    const user = userEvent.setup();
    render(<ExtrasSidebar />);

    fireEvent.contextMenu(screen.getByRole("button", { name: /vendor\/lib/ }));
    await user.click(screen.getByRole("menuitem", { name: "Sync" }));

    expect(submoduleSync).toHaveBeenCalledWith("/tmp/repo");
  });

  it("keeps the Worktrees section visible with a single one to create more", async () => {
    vi.mocked(submoduleStatus).mockResolvedValue([]);
    vi.mocked(worktreeList).mockResolvedValue([WORKTREES[0]]);
    vi.mocked(lfsStatus).mockResolvedValue({
      installed: true,
      version: "git-lfs/3.5.1",
      configured: false,
    });
    useExtrasStore.setState({
      submodules: [],
      worktrees: [WORKTREES[0]],
      lfs: { installed: true, version: "git-lfs/3.5.1", configured: false },
    });

    render(<ExtrasSidebar />);

    expect(screen.getByRole("button", { name: "Worktrees" })).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
  });

  it("creates a worktree from the section menu", async () => {
    const user = userEvent.setup();
    render(<ExtrasSidebar />);

    fireEvent.contextMenu(screen.getByRole("button", { name: "Worktrees" }));
    await user.click(screen.getByRole("menuitem", { name: "New worktree…" }));

    await user.type(screen.getByLabelText("Worktree folder"), "/tmp/nueva");
    await user.type(screen.getByLabelText("Worktree branch"), "topic2");
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(worktreeAdd).toHaveBeenCalledWith("/tmp/repo", "/tmp/nueva", "topic2", true, "HEAD");
  });

  it("removes a worktree after confirming", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    render(<ExtrasSidebar />);

    fireEvent.contextMenu(screen.getByRole("button", { name: /wt-topic/ }));
    await user.click(screen.getByRole("menuitem", { name: "Remove" }));

    expect(confirmDestructive).toHaveBeenCalledWith("Remove worktree wt-topic?");
    expect(worktreeRemove).toHaveBeenCalledWith("/tmp/repo", "/tmp/wt-topic", false);
  });

  it("does not offer to remove the current worktree", async () => {
    render(<ExtrasSidebar />);

    fireEvent.contextMenu(screen.getByText("current").closest("button")!);

    expect(screen.getByRole("menuitem", { name: "Remove" })).toBeDisabled();
  });

  it("shows the Git LFS section with the installed version", async () => {
    render(<ExtrasSidebar />);

    expect(screen.getByRole("button", { name: "Git LFS" })).toBeInTheDocument();
    expect(screen.getByText("git-lfs/3.5.1")).toBeInTheDocument();
  });

  it("warns when LFS is configured but not installed", () => {
    const missing: LfsStatus = { installed: false, version: null, configured: true };
    vi.mocked(lfsStatus).mockResolvedValue(missing);
    useExtrasStore.setState({ lfs: missing });

    render(<ExtrasSidebar />);

    expect(screen.getByText("Not installed")).toBeInTheDocument();
  });
});
