import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import { openEditor, revealInFileManager } from "../lib/bridge/opener";
import { openPath } from "../lib/bridge/settings";
import { logPage } from "../lib/bridge/log";
import { discardPath, stagePath, statusRepo, unstagePath } from "../lib/bridge/status";
import type { RepoInfo, StatusReport } from "../lib/bridge/types";
import { useExtrasStore } from "../lib/stores/extras";
import { useLogStore } from "../lib/stores/log";
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

vi.mock("../lib/bridge/opener", () => ({
  openExternal: vi.fn().mockResolvedValue(undefined),
  openTerminal: vi.fn().mockResolvedValue(undefined),
  revealInFileManager: vi.fn().mockResolvedValue(undefined),
  openEditor: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/bridge/settings", () => ({
  openPath: vi.fn().mockResolvedValue(undefined),
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

/** jsdom has no hit testing: the drop target is faked for the pointer drag. */
function stubDropTarget(drop: string) {
  const element = document.createElement("div");
  element.dataset.drop = drop;
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => element,
  });
}

describe("StatusView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(statusRepo).mockResolvedValue(REPORT);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    useRepoStore.setState({ repo: REPO, recents: [], openTabs: [], loading: false, error: null });
    useStatusStore.getState().reset();
    useLogStore.getState().reset();
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
    expect(screen.getByRole("menuitem", { name: "Blame" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy path" })).toBeInTheDocument();
  });

  it("opens files externally from the context menu", async () => {
    const user = userEvent.setup();
    render(<StatusView />);
    fireEvent.contextMenu(await screen.findByText("modificado.txt"), { clientX: 10, clientY: 10 });

    await user.click(screen.getByRole("menuitem", { name: "Open" }));
    expect(openPath).toHaveBeenCalledWith("/tmp/repo/modificado.txt");

    fireEvent.contextMenu(await screen.findByText("modificado.txt"), { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole("menuitem", { name: "Open in VS Code" }));
    expect(openEditor).toHaveBeenCalledWith("/tmp/repo/modificado.txt");

    fireEvent.contextMenu(await screen.findByText("modificado.txt"), { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole("menuitem", { name: "Show in Finder" }));
    expect(revealInFileManager).toHaveBeenCalledWith("/tmp/repo/modificado.txt");
  });

  it("opens the file history from the context menu", async () => {
    const user = userEvent.setup();
    render(<StatusView />);
    fireEvent.contextMenu(await screen.findByText("modificado.txt"), { clientX: 10, clientY: 10 });

    await user.click(screen.getByRole("menuitem", { name: "Show file history" }));

    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, null, {
      grep: "",
      author: "",
      path: "modificado.txt",
      follow: true,
    });
  });

  it("stages a file dragged into the Staged section", async () => {
    stubDropTarget("status-staged");
    render(<StatusView />);
    const row = await screen.findByText("modificado.txt");

    fireEvent.pointerDown(row, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(document, { clientX: 30, clientY: 30 });
    fireEvent.pointerUp(document, { clientX: 30, clientY: 30 });

    expect(stagePath).toHaveBeenCalledWith("/tmp/repo", "modificado.txt", null);
  });

  it("cancels a file drag with Escape", async () => {
    stubDropTarget("status-staged");
    render(<StatusView />);
    const row = await screen.findByText("modificado.txt");

    fireEvent.pointerDown(row, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(document, { clientX: 30, clientY: 30 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(document, { clientX: 30, clientY: 30 });

    expect(stagePath).not.toHaveBeenCalled();
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
