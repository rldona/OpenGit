import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import { discardPath, stagePath, statusRepo, unstagePath } from "../lib/bridge/status";
import type { RepoInfo, StatusReport } from "../lib/bridge/types";
import { useExtrasStore } from "../lib/stores/extras";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
import { useUiStore } from "../lib/stores/ui";
import { StatusView } from "./StatusView";

vi.mock("../lib/bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn(),
}));

vi.mock("../lib/bridge/diff", () => ({
  diffFile: vi.fn(),
  commitFiles: vi.fn(),
  diffNumstat: vi.fn().mockResolvedValue([]),
  stageSelection: vi.fn(),
}));

vi.mock("../lib/bridge/commit", () => ({
  commitMessage: vi.fn().mockResolvedValue(""),
  commitRepo: vi.fn(),
  repoOpState: vi.fn().mockResolvedValue({ merge: false, rebase: false, cherry_pick: false }),
}));

vi.mock("../lib/bridge/repo", () => ({
  authorIdent: vi.fn().mockResolvedValue({ name: "Ana", email: "ana@example.com" }),
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
  head: "aaaaaaaa",
  git_version: "2.50.1",
};

const REPORT: StatusReport = {
  head: "aaaaaaaa",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [
    { kind: "ordinary", xy: "M.", path: "staged.txt", orig_path: null },
    { kind: "ordinary", xy: ".M", path: "modificado.txt", orig_path: null },
    { kind: "untracked", xy: "?", path: "nuevo.txt", orig_path: null },
  ],
};

describe("StatusView", () => {
  beforeEach(() => {
    vi.mocked(statusRepo).mockResolvedValue(REPORT);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useStatusStore.getState().reset();
    useExtrasStore.setState({ lfs: null });
    useUiStore.setState({ fileTree: true });
  });

  it("shows both sections with their files", async () => {
    render(<StatusView />);

    expect(await screen.findByRole("heading", { name: /Staged files/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Unstaged files/ })).toBeInTheDocument();
    expect(screen.getByText("modificado.txt")).toBeInTheDocument();
    expect(screen.getByText("nuevo.txt")).toBeInTheDocument();
  });

  it("stages a modified file with its checkbox", async () => {
    const user = userEvent.setup();
    render(<StatusView />);

    await user.click(await screen.findByLabelText("Stage modificado.txt"));

    expect(stagePath).toHaveBeenCalledWith("/tmp/repo", "modificado.txt", null);
  });

  it("unstages from the checkbox of a staged file", async () => {
    const user = userEvent.setup();
    render(<StatusView />);

    await user.click(await screen.findByLabelText("Unstage staged.txt"));

    expect(unstagePath).toHaveBeenCalledWith("/tmp/repo", "staged.txt", null);
  });

  it("only discards if confirmed", async () => {
    const user = userEvent.setup();
    render(<StatusView />);

    vi.mocked(confirmDestructive).mockResolvedValue(false);
    await user.click(await screen.findByLabelText("Actions for modificado.txt"));
    await user.click(screen.getByRole("menuitem", { name: "Discard" }));
    expect(discardPath).not.toHaveBeenCalled();

    vi.mocked(confirmDestructive).mockResolvedValue(true);
    await user.click(screen.getByLabelText("Actions for modificado.txt"));
    await user.click(screen.getByRole("menuitem", { name: "Discard" }));
    expect(discardPath).toHaveBeenCalledWith("/tmp/repo", "modificado.txt", null);
  });

  it("allows resizing the commit area", async () => {
    render(<StatusView />);

    await screen.findByLabelText("Commit message");
    expect(screen.getByRole("separator", { name: "Resize commit area" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize pending files" })).toBeInTheDocument();
  });

  it("warns if the repo uses LFS and git-lfs is not installed", async () => {
    useExtrasStore.setState({ lfs: { installed: false, version: null, configured: true } });
    render(<StatusView />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Git LFS but git-lfs is not installed",
    );
  });

  it("opens a file context menu", async () => {
    render(<StatusView />);
    fireEvent.contextMenu(await screen.findByText("modificado.txt"), { clientX: 10, clientY: 10 });

    expect(screen.getByRole("menuitem", { name: "Stage" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Discard" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy path" })).toBeInTheDocument();
  });

  it("groups by directories in tree mode and switches to list", async () => {
    const user = userEvent.setup();
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [{ kind: "ordinary", xy: ".M", path: "src/a.txt", orig_path: null }],
    });
    render(<StatusView />);

    expect(await screen.findByRole("button", { name: /src\/$/ })).toBeInTheDocument();
    expect(screen.getByText("a.txt")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "List" }));

    expect(screen.getByText("src/a.txt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /src\/$/ })).not.toBeInTheDocument();
  });

  it("does not warn if Git LFS is installed", async () => {
    useExtrasStore.setState({
      lfs: { installed: true, version: "git-lfs/3.5.1", configured: true },
    });
    render(<StatusView />);

    await screen.findAllByText(/Staged files/);
    expect(screen.queryByText(/git-lfs is not installed/)).not.toBeInTheDocument();
  });
});
