import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { commitRepo, repoOpState } from "../lib/bridge/commit";
import type { RepoInfo, StatusReport } from "../lib/bridge/types";
import { useCommitStore } from "../lib/stores/commit";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
import { CommitPanel } from "./CommitPanel";

vi.mock("../lib/bridge/commit", () => ({
  commitMessage: vi.fn().mockResolvedValue(""),
  commitRepo: vi.fn(),
  repoOpState: vi.fn(),
}));

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn().mockResolvedValue(true),
}));

vi.mock("../lib/bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

vi.mock("../lib/bridge/log", () => ({
  logPage: vi.fn().mockResolvedValue([]),
  listRefs: vi.fn().mockResolvedValue([]),
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

const REPORT: StatusReport = {
  head: "aaaa",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [{ kind: "ordinary", xy: "M.", path: "staged.txt", orig_path: null }],
};

describe("CommitPanel", () => {
  beforeEach(() => {
    vi.mocked(repoOpState).mockResolvedValue({ merge: false, rebase: false, cherry_pick: false });
    vi.mocked(commitRepo).mockResolvedValue({ hash: "abc1234", subject: "feat: algo" });
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useStatusStore.getState().reset();
    useStatusStore.setState({ report: REPORT, root: REPO.root });
    useCommitStore.getState().reset();
  });

  it("muestra los ficheros staged antes de commitear", async () => {
    render(<CommitPanel />);

    expect(await screen.findByRole("heading", { name: /Staged/ })).toBeInTheDocument();
    expect(screen.getByText("staged.txt")).toBeInTheDocument();
  });

  it("rechaza commitear sin mensaje", async () => {
    const user = userEvent.setup();
    render(<CommitPanel />);

    await user.click(screen.getByRole("button", { name: "Commit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Write a commit message");
    expect(commitRepo).not.toHaveBeenCalled();
  });

  it("commitea con el mensaje escrito", async () => {
    const user = userEvent.setup();
    render(<CommitPanel />);

    await user.type(screen.getByLabelText("Commit message"), "feat: algo");
    await user.click(screen.getByRole("button", { name: "Commit" }));

    expect(commitRepo).toHaveBeenCalledWith("/tmp/repo", "feat: algo", false);
  });

  it("avisa de un merge en curso y deshabilita el commit", async () => {
    vi.mocked(repoOpState).mockResolvedValue({ merge: true, rebase: false, cherry_pick: false });
    render(<CommitPanel />);

    expect(await screen.findByRole("status")).toHaveTextContent("merge in progress");
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
  });
});
