import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoInfo } from "../lib/bridge/types";
import { useRepoStore } from "../lib/stores/repo";
import { RepoTabs } from "./RepoTabs";

const REPO_A: RepoInfo = {
  root: "/tmp/repo-a",
  name: "repo-a",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "aaaa0000",
  git_version: "2.50.1",
};

const REPO_B: RepoInfo = {
  ...REPO_A,
  root: "/tmp/repo-b",
  name: "repo-b",
};

function tabs() {
  return [
    { path: REPO_A.root, name: REPO_A.name, opened_at: 1 },
    { path: REPO_B.root, name: REPO_B.name, opened_at: 2 },
  ];
}

describe("RepoTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRepoStore.setState({
      repo: null,
      recents: [],
      openTabs: [],
      loading: false,
      error: null,
    });
  });

  it("renders nothing with zero or one open repo", () => {
    const { rerender } = render(<RepoTabs />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();

    useRepoStore.setState({ repo: REPO_A, openTabs: [tabs()[0]] });
    rerender(<RepoTabs />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("marks the active repo tab as selected with its path as tooltip", () => {
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs() });
    render(<RepoTabs />);

    const tabA = screen.getByRole("tab", { name: "repo-a" });
    const tabB = screen.getByRole("tab", { name: "repo-b" });
    expect(tabA).toHaveAttribute("aria-selected", "true");
    expect(tabB).toHaveAttribute("aria-selected", "false");
    expect(tabA).toHaveAttribute("title", "/tmp/repo-a");
  });

  it("switches repository when a tab is clicked", async () => {
    const user = userEvent.setup();
    const open = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), open });
    render(<RepoTabs />);

    await user.click(screen.getByRole("tab", { name: "repo-b" }));

    expect(open).toHaveBeenCalledWith(REPO_B.root);
  });

  it("closes the tab with the close button", async () => {
    const user = userEvent.setup();
    const closeTab = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), closeTab });
    render(<RepoTabs />);

    await user.click(screen.getByRole("button", { name: "Close repo-b" }));

    expect(closeTab).toHaveBeenCalledWith(REPO_B.root);
  });
});
