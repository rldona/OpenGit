import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { grepWorktree } from "../lib/bridge/grep";
import type { RepoInfo } from "../lib/bridge/types";
import { useDiffStore } from "../lib/stores/diff";
import { useGrepStore } from "../lib/stores/grep";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";
import { SearchView } from "./SearchView";

vi.mock("../lib/bridge/grep", () => ({
  grepWorktree: vi.fn(),
}));

const REPO: RepoInfo = {
  root: "/tmp/repo",
  name: "repo",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "aaaa0000",
  git_version: "2.50.1",
};

describe("SearchView", () => {
  beforeEach(() => {
    useGrepStore.getState().reset();
    useRepoStore.setState({ repo: REPO });
    vi.mocked(grepWorktree).mockReset();
    vi.mocked(grepWorktree).mockResolvedValue({ matches: [], truncated: false });
  });

  it("runs the search and lists matches grouped by file", async () => {
    const user = userEvent.setup();
    vi.mocked(grepWorktree).mockResolvedValue({
      matches: [
        { path: "a.txt", line: 3, text: "hello world" },
        { path: "a.txt", line: 9, text: "hello again" },
      ],
      truncated: false,
    });
    render(<SearchView />);

    await user.type(screen.getByLabelText("Search in working tree"), "hello");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("a.txt")).toBeInTheDocument();
    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.getByText("hello again")).toBeInTheDocument();
  });

  it("opens the file diff when a match is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(grepWorktree).mockResolvedValue({
      matches: [{ path: "a.txt", line: 1, text: "hello" }],
      truncated: false,
    });
    const openWorktreeFile = vi
      .spyOn(useDiffStore.getState(), "openWorktreeFile")
      .mockResolvedValue(undefined);
    const setActiveView = vi
      .spyOn(useUiStore.getState(), "setActiveView")
      .mockImplementation(() => {});
    render(<SearchView />);

    await user.type(screen.getByLabelText("Search in working tree"), "hello");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByText("hello"));

    expect(openWorktreeFile).toHaveBeenCalledWith("/tmp/repo", "a.txt");
    expect(setActiveView).toHaveBeenCalledWith("diff");
    openWorktreeFile.mockRestore();
    setActiveView.mockRestore();
  });

  it("reports when there are no matches", async () => {
    const user = userEvent.setup();
    render(<SearchView />);

    await user.type(screen.getByLabelText("Search in working tree"), "zzz");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("No matches.")).toBeInTheDocument();
  });
});
