import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeBranch } from "../lib/bridge/refs";
import type { RefEntry, RepoInfo } from "../lib/bridge/types";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";
import { MergeDialog } from "./MergeDialog";

vi.mock("../lib/bridge/refs", () => ({
  branchTracking: vi
    .fn()
    .mockResolvedValue({ current: "main", upstream: null, ahead: 0, behind: 0 }),
  checkoutRef: vi.fn(),
  createBranch: vi.fn(),
  renameBranch: vi.fn(),
  deleteBranch: vi.fn(),
  mergeBranch: vi.fn().mockResolvedValue({ conflicted: false, output: "" }),
}));

vi.mock("../lib/bridge/log", () => ({
  listRefs: vi.fn().mockResolvedValue([]),
  logPage: vi.fn().mockResolvedValue([]),
}));

vi.mock("../lib/bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

vi.mock("../lib/bridge/commit", () => ({
  commitMessage: vi.fn().mockResolvedValue(""),
  commitRepo: vi.fn(),
  repoOpState: vi.fn().mockResolvedValue({
    merge: false,
    rebase: false,
    cherry_pick: false,
    revert: false,
    rebase_current: null,
    rebase_total: null,
  }),
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

const branch = (name: string): RefEntry => ({
  name,
  object_id: "a",
  object_type: "commit",
  upstream: null,
  track: null,
  target: "a",
});

describe("MergeDialog", () => {
  beforeEach(() => {
    useRepoStore.setState({ repo: REPO });
    useRefsStore.getState().reset();
    useRefsStore.setState({
      root: REPO.root,
      current: "main",
      refs: [branch("refs/heads/main"), branch("refs/heads/feature")],
    });
    useUiStore.setState({ outputLines: [] });
  });

  it("lists the other branches and shows the destination", () => {
    render(<MergeDialog onClose={() => {}} />);

    expect(screen.getByLabelText("Merge branch")).toHaveValue("");
    expect(screen.getByRole("option", { name: "feature" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "main" })).not.toBeInTheDocument();
    expect(screen.getByText("main", { selector: ".remote-value" })).toBeInTheDocument();
  });

  it("does not allow merging without choosing a branch", async () => {
    render(<MergeDialog onClose={() => {}} />);

    expect(screen.getByRole("button", { name: "Merge" })).toBeDisabled();
  });

  it("merges the chosen branch with --no-ff if checked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MergeDialog onClose={onClose} />);

    await user.selectOptions(screen.getByLabelText("Merge branch"), "feature");
    await user.click(screen.getByLabelText(/Create a merge commit/));
    await user.click(screen.getByRole("button", { name: "Merge" }));

    expect(mergeBranch).toHaveBeenCalledWith("/tmp/repo", "feature", true);
    expect(onClose).toHaveBeenCalled();
  });
});
