import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeBranch } from "../lib/bridge/refs";
import { listRefs, logPage } from "../lib/bridge/log";
import type { Commit, RefEntry, RepoInfo } from "../lib/bridge/types";
import { useDiffStore } from "../lib/stores/diff";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { MergeWindow } from "./MergeWindow";

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
  listRefs: vi.fn(),
  logPage: vi.fn(),
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

vi.mock("../lib/bridge/diff", () => ({
  diffFile: vi.fn().mockResolvedValue("diff --git a/a.txt b/a.txt\n@@ -1 +1 @@\n-a\n+b\n"),
  commitFiles: vi
    .fn()
    .mockResolvedValue([{ path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 0 }]),
  diffNumstat: vi.fn().mockResolvedValue([]),
  stageSelection: vi.fn(),
  discardSelection: vi.fn(),
  imagePair: vi.fn(),
  imageBlob: vi.fn(),
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
  head: "aaaa0000",
  git_version: "2.50.1",
};

function commit(hash: string, subject: string): Commit {
  return {
    hash,
    parents: [],
    author_name: "Ana",
    author_email: "ana@example.com",
    author_time: 1_700_000_000,
    refs: [],
    subject,
    body: "",
  };
}

const REFS: RefEntry[] = [
  {
    name: "refs/heads/main",
    object_id: "aaaa0000",
    object_type: "commit",
    upstream: null,
    track: null,
    target: "aaaa0000",
  },
  {
    name: "refs/heads/feature",
    object_id: "bbbb0000",
    object_type: "commit",
    upstream: null,
    track: null,
    target: "bbbb0000",
  },
  {
    name: "refs/tags/v1.0.0",
    object_id: "cccc0000",
    object_type: "commit",
    upstream: null,
    track: null,
    target: "cccc0000",
  },
];

describe("MergeWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useRefsStore.getState().reset();
    useRefsStore.setState({ root: REPO.root, current: "main", refs: REFS });
    useDiffStore.getState().reset();
    vi.mocked(listRefs).mockResolvedValue(REFS);
    vi.mocked(logPage).mockResolvedValue([
      commit("cccc0000", "tag commit"),
      commit("bbbb0000", "feature commit"),
      commit("aaaa0000", "main commit"),
    ]);
  });

  it("opens on the log tab with the commit table and the options", async () => {
    render(<MergeWindow onClose={() => {}} />);

    expect(screen.getByRole("tab", { name: "Merge From Log" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByRole("button", { name: /feature commit/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Commit merge immediately/)).toBeChecked();
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
  });

  it("merges the picked commit with the chosen options", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MergeWindow onClose={onClose} />);

    await user.click(await screen.findByRole("button", { name: /feature commit/ }));
    await user.click(screen.getByLabelText(/Commit merge immediately/));
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(mergeBranch).toHaveBeenCalledWith("/tmp/repo", "bbbb0000", {
      noFf: false,
      noCommit: true,
      includeMessages: false,
      rebase: false,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the branch picker in the Merge Fetched tab", async () => {
    const user = userEvent.setup();
    render(<MergeWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Merge Fetched" }));
    const select = screen.getByLabelText("Merge branch");
    expect(within(select).queryByRole("option", { name: "main" })).not.toBeInTheDocument();

    await user.selectOptions(select, "feature");
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(mergeBranch).toHaveBeenCalledWith(
      "/tmp/repo",
      "feature",
      expect.objectContaining({ noFf: false }),
    );
  });

  it("jumps to a ref and picks its commit", async () => {
    const user = userEvent.setup();
    render(<MergeWindow onClose={() => {}} />);

    await screen.findByRole("button", { name: /tag commit/ });
    await user.selectOptions(screen.getByLabelText("Jump to"), "refs/tags/v1.0.0");

    const row = screen.getByRole("button", { name: /tag commit/ });
    expect(row).toHaveClass("selected");

    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(mergeBranch).toHaveBeenCalledWith(
      "/tmp/repo",
      "cccc0000",
      expect.objectContaining({ rebase: false }),
    );
  });

  it("ancestor order reloads the log pointing at HEAD", async () => {
    const user = userEvent.setup();
    render(<MergeWindow onClose={() => {}} />);

    await screen.findByRole("button", { name: /feature commit/ });
    vi.mocked(logPage).mockClear();

    await user.click(screen.getByLabelText("Ancestor Order"));

    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, "HEAD", null);
  });

  it("restores the diff view that was behind the window", async () => {
    const user = userEvent.setup();
    useDiffStore.setState({ patch: "ORIGINAL" });
    const { unmount } = render(<MergeWindow onClose={() => {}} />);

    await user.click(await screen.findByRole("button", { name: /feature commit/ }));
    expect(useDiffStore.getState().patch).not.toBe("ORIGINAL");

    // The window closes when its parent unmounts it (App sets mergeOpen=false).
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    unmount();

    expect(useDiffStore.getState().patch).toBe("ORIGINAL");
  });
});
