import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { repoOpState } from "../lib/bridge/commit";
import { repoOpAbort, repoOpContinue, repoOpSkip } from "../lib/bridge/ops";
import type { RepoInfo } from "../lib/bridge/types";
import { useCommitStore } from "../lib/stores/commit";
import { useRepoStore } from "../lib/stores/repo";
import { OpBanner } from "./OpBanner";

vi.mock("../lib/bridge/commit", () => ({
  commitMessage: vi.fn().mockResolvedValue(""),
  commitRepo: vi.fn(),
  repoOpState: vi.fn(),
}));

vi.mock("../lib/bridge/ops", () => ({
  repoOpAbort: vi.fn().mockResolvedValue(undefined),
  repoOpContinue: vi.fn().mockResolvedValue(undefined),
  repoOpSkip: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/bridge/status", () => ({
  statusRepo: vi.fn().mockResolvedValue({
    head: "a",
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

vi.mock("../lib/bridge/log", () => ({
  listRefs: vi.fn().mockResolvedValue([]),
  logPage: vi.fn().mockResolvedValue([]),
}));

vi.mock("../lib/bridge/refs", () => ({
  branchTracking: vi
    .fn()
    .mockResolvedValue({ current: "main", upstream: null, ahead: 0, behind: 0 }),
  checkoutRef: vi.fn(),
  createBranch: vi.fn(),
  renameBranch: vi.fn(),
  deleteBranch: vi.fn(),
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

const CLEAN = {
  merge: false,
  rebase: false,
  cherry_pick: false,
  revert: false,
  rebase_current: null,
  rebase_total: null,
};

describe("OpBanner", () => {
  beforeEach(() => {
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useCommitStore.getState().reset();
    vi.mocked(repoOpState).mockResolvedValue(CLEAN);
  });

  it("no muestra nada si no hay operación en curso", () => {
    render(<OpBanner />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("muestra el merge en curso con Abort y Continue", async () => {
    vi.mocked(repoOpState).mockResolvedValue({ ...CLEAN, merge: true });
    render(<OpBanner />);

    expect(await screen.findByRole("status")).toHaveTextContent("merge in progress");
    expect(screen.getByRole("button", { name: "Abort" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("muestra el paso del rebase", async () => {
    vi.mocked(repoOpState).mockResolvedValue({
      ...CLEAN,
      rebase: true,
      rebase_current: 2,
      rebase_total: 5,
    });
    render(<OpBanner />);

    expect(await screen.findByRole("status")).toHaveTextContent("rebase (2/5) in progress");
  });

  it("aborta y continúa la operación", async () => {
    vi.mocked(repoOpState).mockResolvedValue({ ...CLEAN, cherry_pick: true });
    const user = userEvent.setup();
    render(<OpBanner />);

    await user.click(await screen.findByRole("button", { name: "Abort" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(repoOpAbort).toHaveBeenCalledWith("/tmp/repo");
    expect(repoOpContinue).toHaveBeenCalledWith("/tmp/repo");
  });

  it("ofrece Skip en rebase y cherry-pick", async () => {
    vi.mocked(repoOpState).mockResolvedValue({ ...CLEAN, rebase: true });
    const user = userEvent.setup();
    render(<OpBanner />);

    await user.click(await screen.findByRole("button", { name: "Skip" }));

    expect(repoOpSkip).toHaveBeenCalledWith("/tmp/repo");
  });

  it("no ofrece Skip en un merge", async () => {
    vi.mocked(repoOpState).mockResolvedValue({ ...CLEAN, merge: true });
    render(<OpBanner />);

    expect(await screen.findByRole("status")).toHaveTextContent("merge in progress");
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
  });
});
