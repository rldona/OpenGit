import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { commitFiles, diffFile } from "../lib/bridge/diff";
import type { Commit, RepoInfo } from "../lib/bridge/types";
import { useDiffStore } from "../lib/stores/diff";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";
import { CommitDetailPanel, COMMIT_DIFF_DEBOUNCE_MS } from "./CommitDetailPanel";

vi.mock("./DiffEditor", () => ({
  DiffEditor: () => <div data-testid="diff-editor" />,
}));

vi.mock("../lib/bridge/diff", () => ({
  diffFile: vi.fn(),
  commitFiles: vi.fn(),
  diffNumstat: vi.fn(),
  stageSelection: vi.fn(),
  discardSelection: vi.fn(),
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
  head: "aaaa0003",
  git_version: "2.43.0",
};

function commit(hash: string, body = ""): Commit {
  return {
    hash,
    parents: [],
    author_name: "Ana",
    author_email: "ana@example.com",
    author_time: 1_700_000_000,
    subject: `commit ${hash}`,
    refs: [],
    body,
  };
}

describe("CommitDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDiffStore.getState().reset();
    useUiStore.setState({ fileTree: false });
    useRepoStore.setState({ repo: REPO });
    vi.mocked(commitFiles).mockResolvedValue([
      { path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 0 },
    ]);
    vi.mocked(diffFile).mockResolvedValue("diff --git a/a.txt b/a.txt\n@@ -1 +1 @@\n-a\n+b\n");
  });

  it("shows the commit author, date and hash", async () => {
    render(<CommitDetailPanel commit={commit("aaaa1111")} />);

    expect(screen.getByText(/Ana <ana@example\.com>/)).toBeInTheDocument();
    expect(screen.getByText("aaaa1111")).toBeInTheDocument();
    expect(await screen.findAllByText("a.txt")).not.toHaveLength(0);
  });

  it("does not repeat the commit actions here: they live in the context menu", () => {
    render(<CommitDetailPanel commit={commit("aaaa1111")} />);

    expect(screen.queryByRole("button", { name: "Cherry-pick" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revert" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset to here" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rebase from here" })).not.toBeInTheDocument();
  });

  it("shows the message body when there is one", async () => {
    render(<CommitDetailPanel commit={commit("aaaa1111", "Primera línea.\nSegunda línea.")} />);

    const body = await screen.findByText(/Primera línea\./);
    expect(body).toHaveTextContent("Segunda línea.");
  });

  it("omits the body when the commit only has a subject", () => {
    const { container } = render(<CommitDetailPanel commit={commit("aaaa1111")} />);

    expect(container.querySelector(".commit-meta-body")).toBeNull();
  });

  it("allows changing the diff mode and the file view", async () => {
    const user = userEvent.setup();
    render(<CommitDetailPanel commit={commit("aaaa1111")} />);

    await user.click(screen.getByRole("button", { name: "Side by side" }));
    expect(useDiffStore.getState().mode).toBe("side");

    await user.click(screen.getByRole("button", { name: "Tree" }));
    expect(useUiStore.getState().fileTree).toBe(true);
  });

  it("does not request the diff once per commit when navigating quickly", async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<CommitDetailPanel commit={commit("aaaa0001")} />);
      rerender(<CommitDetailPanel commit={commit("aaaa0002")} />);
      rerender(<CommitDetailPanel commit={commit("aaaa0003")} />);

      expect(commitFiles).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(COMMIT_DIFF_DEBOUNCE_MS + 10);
      });

      expect(commitFiles).toHaveBeenCalledTimes(1);
      expect(commitFiles).toHaveBeenCalledWith("/tmp/repo", "aaaa0003");
    } finally {
      vi.useRealTimers();
    }
  });
});
