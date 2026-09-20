import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import { reflog } from "../lib/bridge/reflog";
import { createBranch } from "../lib/bridge/refs";
import type { RepoInfo } from "../lib/bridge/types";
import { useReflogStore } from "../lib/stores/reflog";
import { useRepoStore } from "../lib/stores/repo";
import { ReflogView } from "./ReflogView";

vi.mock("../lib/bridge/reflog", () => ({ reflog: vi.fn() }));
vi.mock("../lib/bridge/refs", () => ({
  checkoutRef: vi.fn().mockResolvedValue(undefined),
  createBranch: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/bridge/history", () => ({ resetTo: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/bridge/dialog", () => ({
  confirmDestructive: vi.fn().mockResolvedValue(true),
}));
vi.mock("../lib/clipboard", () => ({ copyText: vi.fn().mockResolvedValue(undefined) }));

const REPO: RepoInfo = {
  root: "/tmp/repo",
  name: "repo",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "aaaa0000",
  git_version: "2.50.1",
};

describe("ReflogView", () => {
  beforeEach(() => {
    useReflogStore.getState().resetState();
    useRepoStore.setState({ repo: REPO });
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    vi.mocked(reflog).mockResolvedValue([
      {
        hash: "abcdef1234",
        selector: "HEAD@{0}",
        subject: "commit: second",
        author: "Ana",
        time: 1_789_725_600,
      },
    ]);
  });

  it("lists the reflog entries", async () => {
    render(<ReflogView />);

    expect(await screen.findByText("HEAD@{0}")).toBeInTheDocument();
    expect(screen.getByText("commit: second")).toBeInTheDocument();
  });

  it("creates a branch at an entry", async () => {
    const user = userEvent.setup();
    render(<ReflogView />);

    await screen.findByText("HEAD@{0}");
    await user.click(screen.getByRole("button", { name: "Create branch" }));
    await user.type(screen.getByLabelText("New branch name"), "recovered");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(createBranch).toHaveBeenCalledWith("/tmp/repo", "recovered", "abcdef1234");
  });
});
