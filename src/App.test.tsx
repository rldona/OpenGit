import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { pickDirectory } from "./lib/bridge/dialog";
import { startRemoteJob } from "./lib/bridge/jobs";
import { readConflictFile } from "./lib/bridge/conflict";
import { subscribeRepoEvents } from "./lib/bridge/events";
import { setWindowTitle } from "./lib/bridge/window";
import { cherryPick } from "./lib/bridge/history";
import { repoOpAbort } from "./lib/bridge/ops";
import { commitRepo, repoOpState } from "./lib/bridge/commit";
import { listRefs, logPage } from "./lib/bridge/log";
import { openRepo, recentRepos } from "./lib/bridge/repo";
import { commitFiles, diffFile, diffNumstat } from "./lib/bridge/diff";
import { statusRepo } from "./lib/bridge/status";
import { stashList } from "./lib/bridge/stash";
import type { Commit, RepoInfo, StatusReport } from "./lib/bridge/types";
import { useDiffStore } from "./lib/stores/diff";
import { useCommitStore } from "./lib/stores/commit";
import { useExtrasStore } from "./lib/stores/extras";
import { useLogStore } from "./lib/stores/log";
import { useRepoStore } from "./lib/stores/repo";
import { useStatusStore } from "./lib/stores/status";
import { useRefsStore } from "./lib/stores/refs";
import { useThemeStore } from "./lib/stores/theme";
import { useUiStore } from "./lib/stores/ui";
import { THEME_STORAGE_KEY } from "./lib/theme";

vi.mock("./lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn().mockResolvedValue(true),
}));

vi.mock("./lib/bridge/rebase", () => ({
  rebasePlan: vi.fn().mockResolvedValue([]),
  interactiveRebase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lib/bridge/conflict", () => ({
  readConflictFile: vi.fn(),
  resolveConflict: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lib/bridge/ops", () => ({
  repoOpAbort: vi.fn().mockResolvedValue(undefined),
  repoOpContinue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lib/bridge/history", () => ({
  cherryPick: vi.fn().mockResolvedValue(undefined),
  revertCommit: vi.fn().mockResolvedValue(undefined),
  resetMixed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lib/bridge/repo", () => ({
  gitVersion: vi.fn(),
  openRepo: vi.fn(),
  recentRepos: vi.fn(),
  removeRecentRepo: vi.fn(),
  closeRepo: vi.fn(),
  submoduleStatus: vi.fn().mockResolvedValue([]),
  worktreeList: vi.fn().mockResolvedValue([]),
  lfsStatus: vi
    .fn()
    .mockResolvedValue({ installed: true, version: "git-lfs/3.5.1", configured: false }),
  remoteUrls: vi.fn().mockResolvedValue([]),
}));

vi.mock("./lib/bridge/log", () => ({
  logPage: vi.fn(),
  listRefs: vi.fn(),
}));

vi.mock("./lib/bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

const menuMock = vi.hoisted(() => ({ handler: null as ((id: string) => void) | null }));

vi.mock("./lib/bridge/events", () => ({
  subscribeRepoEvents: vi.fn().mockResolvedValue([]),
  subscribeJobEvents: vi.fn().mockResolvedValue([]),
  subscribeMenuEvents: vi.fn((handler: (id: string) => void) => {
    menuMock.handler = handler;
    return Promise.resolve(() => {});
  }),
}));

vi.mock("./lib/bridge/window", () => ({
  setWindowTitle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lib/bridge/jobs", () => ({
  startRemoteJob: vi.fn().mockResolvedValue("job-1"),
  cancelRemoteJob: vi.fn().mockResolvedValue(true),
}));

vi.mock("./lib/bridge/diff", () => ({
  diffFile: vi.fn(),
  commitFiles: vi.fn(),
  diffNumstat: vi.fn(),
  stageSelection: vi.fn(),
}));

vi.mock("./lib/bridge/commit", () => ({
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

vi.mock("./lib/bridge/refs", () => ({
  branchTracking: vi
    .fn()
    .mockResolvedValue({ current: "main", upstream: null, ahead: 0, behind: 0 }),
  checkoutRef: vi.fn(),
  createBranch: vi.fn(),
  renameBranch: vi.fn(),
  deleteBranch: vi.fn(),
  mergeBranch: vi.fn().mockResolvedValue({ conflicted: false, output: "" }),
}));

vi.mock("./lib/bridge/tags", () => ({
  tagCreate: vi.fn().mockResolvedValue(undefined),
  tagDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lib/bridge/stash", () => ({
  stashList: vi.fn().mockResolvedValue([]),
  stashPush: vi.fn().mockResolvedValue(undefined),
  stashApply: vi.fn().mockResolvedValue(undefined),
  stashDrop: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./components/DiffEditor", () => ({
  DiffEditor: () => <div data-testid="diff-editor" />,
}));

const REPO: RepoInfo = {
  root: "/tmp/mi-repo",
  name: "mi-repo",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "0123456789abcdef",
  git_version: "2.50.1",
};

const COMMIT: Commit = {
  hash: "aaaa0000",
  parents: [],
  author_name: "Test",
  author_email: "test@opengit.dev",
  author_time: 1_789_725_600,
  refs: ["HEAD -> main"],
  subject: "commit de prueba",
  body: "Cuerpo del commit.\nSegunda línea.",
};

const REPORT: StatusReport = {
  head: "aaaa0000",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [{ kind: "ordinary", xy: "M.", path: "staged.txt", orig_path: null }],
};

/** The list row: the subject is repeated in the detail panel. */
async function findCommitRow(): Promise<HTMLElement> {
  await screen.findAllByText("commit de prueba");
  return document.querySelector(".commit-row:not(.worktree-row) .commit-subject") as HTMLElement;
}

describe("App", () => {
  beforeEach(() => {
    vi.mocked(recentRepos).mockResolvedValue([
      { path: "/tmp/mi-repo", name: "mi-repo", opened_at: 1 },
    ]);
    vi.mocked(pickDirectory).mockResolvedValue("/tmp/mi-repo");
    vi.mocked(openRepo).mockResolvedValue(REPO);
    vi.mocked(listRefs).mockResolvedValue([]);
    vi.mocked(logPage).mockResolvedValue([COMMIT]);
    vi.mocked(statusRepo).mockResolvedValue(REPORT);
    vi.mocked(commitFiles).mockResolvedValue([
      { path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 0 },
    ]);
    vi.mocked(diffNumstat).mockResolvedValue([]);
    vi.mocked(diffFile).mockResolvedValue("diff --git a/a.txt b/a.txt\n@@ -1 +1 @@\n-a\n+b\n");
    vi.mocked(repoOpState).mockResolvedValue({
      merge: false,
      rebase: false,
      cherry_pick: false,
      revert: false,
      rebase_current: null,
      rebase_total: null,
    });
    useRepoStore.setState({ repo: null, recents: [], loading: false, error: null });
    useCommitStore.getState().reset();
    useExtrasStore.getState().reset();
    useLogStore.getState().reset();
    useStatusStore.getState().reset();
    useDiffStore.getState().reset();
    useUiStore.setState({
      outputOpen: false,
      outputLines: ["OpenGit listo."],
      activeView: "history",
      shortcutsOpen: false,
      fileTree: true,
    });
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    useThemeStore.setState({ preference: "system", systemDark: true, resolved: "dark" });
  });

  it("shows the empty state with the Output panel hidden by default", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "No repository open" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Output" })).not.toBeInTheDocument();
  });

  it("opens the chosen repository and shows the history", async () => {
    const user = userEvent.setup();
    useUiStore.setState({ outputOpen: true });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));

    expect(openRepo).toHaveBeenCalledWith("/tmp/mi-repo");
    expect(await screen.findAllByText("commit de prueba")).not.toHaveLength(0);
    expect(subscribeRepoEvents).toHaveBeenCalled();
    expect(await screen.findByText(/Repository opened: mi-repo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fetch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Push" })).toBeInTheDocument();
    const header = document.querySelector(".commit-header") as HTMLElement;
    expect(within(header).getByText("Graph")).toBeInTheDocument();
    expect(within(header).getByText("Description")).toBeInTheDocument();
    expect(within(header).getByText("Commit")).toBeInTheDocument();
    expect(within(header).getByText("Author")).toBeInTheDocument();
    expect(within(header).getByText("Date")).toBeInTheDocument();
  });

  it("opens the conflict editor from File status", async () => {
    const user = userEvent.setup();
    const conflictContent = [
      "comun",
      "<<<<<<< HEAD",
      "nuestra",
      "=======",
      "suya",
      ">>>>>>> feature",
      "",
    ].join("\n");
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [{ kind: "unmerged", xy: "UU", path: "conflicto.txt", orig_path: null }],
    });
    vi.mocked(readConflictFile).mockResolvedValue({ content: conflictContent, binary: false });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByRole("button", { name: "File status" }));
    await user.click(await screen.findByText("conflicto.txt"));

    expect(await screen.findByRole("button", { name: "Take ours" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conflicts (1)" })).toBeInTheDocument();
  });

  it("shows the operation banner with Abort and Continue", async () => {
    const user = userEvent.setup();
    vi.mocked(repoOpState).mockResolvedValue({
      merge: true,
      rebase: false,
      cherry_pick: false,
      revert: false,
      rebase_current: null,
      rebase_total: null,
    });
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    render(<App />);

    expect(await screen.findByRole("status")).toHaveTextContent("merge in progress");

    await user.click(screen.getByRole("button", { name: "Abort" }));

    expect(repoOpAbort).toHaveBeenCalledWith("/tmp/mi-repo");
  });

  it("the Pull button opens the options dialog without starting the job", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    await user.click(screen.getByRole("button", { name: "Pull" }));

    expect(screen.getByRole("dialog", { name: "Pull" })).toBeInTheDocument();
    expect(startRemoteJob).not.toHaveBeenCalled();
  });

  it("sorts the table by columns and returns to topological order", async () => {
    const user = userEvent.setup();
    vi.mocked(logPage).mockResolvedValue([
      { ...COMMIT, hash: "cccc0001", subject: "c commit", author_time: 100 },
      { ...COMMIT, hash: "aaaa0002", subject: "a commit", author_time: 300 },
      { ...COMMIT, hash: "bbbb0003", subject: "b commit", author_time: 200 },
    ]);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await screen.findAllByText("c commit");

    const subjects = () =>
      Array.from(document.querySelectorAll(".commit-row:not(.worktree-row) .commit-subject")).map(
        (node) => node.textContent,
      );

    expect(subjects()).toEqual(["c commit", "a commit", "b commit"]);
    expect(document.querySelector(".history-graph")).not.toBeNull();

    // Ascending by description: the graph is hidden.
    await user.click(screen.getByRole("button", { name: "Sort by Description" }));
    expect(subjects()).toEqual(["a commit", "b commit", "c commit"]);
    expect(document.querySelector(".history-graph")).toBeNull();

    // Descending.
    await user.click(screen.getByRole("button", { name: "Sort by Description" }));
    expect(subjects()).toEqual(["c commit", "b commit", "a commit"]);

    // Third click: topological order and the graph come back.
    await user.click(screen.getByRole("button", { name: "Sort by Description" }));
    expect(subjects()).toEqual(["c commit", "a commit", "b commit"]);
    expect(document.querySelector(".history-graph")).not.toBeNull();
  });

  it("the Merge button opens the branches dialog", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    await user.click(screen.getByRole("button", { name: "Merge" }));

    expect(screen.getByRole("dialog", { name: "Merge" })).toBeInTheDocument();
  });

  it("the Fetch button opens the options dialog", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    await user.click(screen.getByRole("button", { name: "Fetch" }));

    expect(screen.getByRole("dialog", { name: "Fetch" })).toBeInTheDocument();
  });

  it("shows the Uncommitted changes row and opens its diff", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();
    useStatusStore.setState({
      report: {
        head: "aaaa0000",
        branch: "main",
        detached: false,
        upstream: null,
        ahead: 0,
        behind: 0,
        entries: [{ kind: "ordinary", xy: ".M", path: "modificado.txt", orig_path: null }],
      },
    });

    const row = await screen.findByRole("button", { name: /Uncommitted changes/ });
    await user.click(row);

    expect(await screen.findByRole("region", { name: "Uncommitted changes" })).toBeInTheDocument();
    expect(row).toHaveClass("selected");
  });

  it("switches to the File status view and shows the changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByRole("button", { name: "File status" }));

    expect((await screen.findAllByRole("heading", { name: /Staged/ })).length).toBeGreaterThan(0);
    expect(screen.getAllByText("staged.txt").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Commit" })).toBeInTheDocument();
  });

  it("selects a commit and shows its details", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await findCommitRow());

    expect(screen.getByRole("region", { name: "Commit details" })).toBeInTheDocument();
    expect(screen.getByText("aaaa0000")).toBeInTheDocument();
    expect(screen.getByText(/Cuerpo del commit\./)).toHaveTextContent("Segunda línea.");
  });

  it("offers cherry-pick, revert and reset in the commit context menu", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    const subject = await findCommitRow();
    fireEvent.contextMenu(subject.closest("button")!);

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Revert" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Reset to here" })).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Interactive rebase from here" }),
    ).toBeInTheDocument();

    await user.click(within(menu).getByRole("menuitem", { name: "Cherry-pick" }));

    expect(cherryPick).toHaveBeenCalledWith("/tmp/mi-repo", "aaaa0000");
  });

  it("shows the commit diff in the lower area without leaving the history", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await findCommitRow());

    expect(await screen.findAllByText("a.txt")).not.toHaveLength(0);
    expect(commitFiles).toHaveBeenCalledWith("/tmp/mi-repo", "aaaa0000");
    // It is still the history view: the commit row does not disappear.
    expect(useUiStore.getState().activeView).toBe("history");
    expect(document.querySelector(".commit-subject")).toHaveTextContent("commit de prueba");
  });

  it("the branch dropdown only lists local branches, not remote ones", async () => {
    const user = userEvent.setup();
    const ref = (name: string) => ({
      name,
      object_id: "aaaa0000",
      object_type: "commit",
      upstream: null,
      track: null,
      target: "aaaa0000",
    });
    vi.mocked(listRefs).mockResolvedValue([
      ref("refs/heads/main"),
      ref("refs/heads/feature"),
      ref("refs/remotes/origin/main"),
      ref("refs/remotes/origin/una-de-mil"),
      ref("refs/tags/v1.0.0"),
    ]);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    const select = await screen.findByRole("combobox", { name: /Branch/i });

    // A real repo has thousands of remote branches: dumping them here renders the
    // dropdown useless.
    expect(within(select).getByRole("option", { name: "main" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "feature" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: /origin\// })).not.toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "v1.0.0" })).not.toBeInTheDocument();
  });

  it("does not reserve a refs column for commits that have none", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    // COMMIT has "HEAD -> main", so the refs block must be rendered.
    expect(document.querySelector(".commit-refs")).not.toBeNull();

    vi.mocked(logPage).mockResolvedValue([{ ...COMMIT, refs: [] }]);
    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    // Without refs the gap is not rendered: the subject sits next to the graph.
    await waitFor(() => expect(document.querySelector(".commit-refs")).toBeNull());
  });

  it("Refresh reloads the stashes too and reports it in the Output", async () => {
    const user = userEvent.setup();
    useUiStore.setState({ outputOpen: true });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();
    vi.mocked(stashList).mockClear();

    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    await waitFor(() => expect(stashList).toHaveBeenCalledWith("/tmp/mi-repo"));
    expect(await screen.findByText("Refreshed mi-repo")).toBeInTheDocument();
  });

  it("resizes the table columns and saves the width", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    const resizer = screen.getByRole("separator", { name: "Resize Author column" });
    const author = document.querySelector(".commit-author") as HTMLElement;
    const inicial = author.style.width;

    // With the keyboard, since jsdom has no real pointer dragging.
    resizer.focus();
    await user.keyboard("{ArrowLeft}");

    expect(author.style.width).not.toBe(inicial);
    expect(localStorage.getItem("opengit.columns.commit-table")).toContain("author");
  });

  it("marks incoming commits in the history", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    act(() => useRefsStore.setState({ incoming: ["aaaa0000"] }));

    expect(screen.getByTitle("Incoming commit")).toBeInTheDocument();
  });

  it("opens a commit context menu and runs the action", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    const subject = await findCommitRow();
    fireEvent.contextMenu(subject.closest("button")!);

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Copy hash" })).toBeInTheDocument();

    await user.click(within(menu).getByRole("menuitem", { name: "Open in Diff view" }));

    expect(useUiStore.getState().activeView).toBe("diff");
    expect(commitFiles).toHaveBeenCalledWith("/tmp/mi-repo", "aaaa0000");
  });

  it("toggles the output panel from Settings", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole("region", { name: "Output" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Toggle output panel" }));
    expect(screen.getByRole("region", { name: "Output" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Toggle output panel" }));
    expect(screen.queryByRole("region", { name: "Output" })).not.toBeInTheDocument();
  });

  it("changes the theme and applies it to the document", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const select = screen.getByRole("combobox", { name: "Theme" });
    expect(select).toHaveValue("system");

    await user.selectOptions(select, "light");

    expect(select).toHaveValue("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    await user.selectOptions(select, "dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("opens the shortcuts help with ? and closes it with Esc", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("?");

    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByText("Ctrl+O")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("opens and closes the help from Settings", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("opens the repository picker with Ctrl+O", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("{Control>}o{/Control}");

    expect(pickDirectory).toHaveBeenCalled();
  });

  it("refreshes status, refs and history with Ctrl+R", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();
    vi.mocked(listRefs).mockClear();

    await user.keyboard("{Control>}r{/Control}");

    expect(listRefs).toHaveBeenCalledWith("/tmp/mi-repo");
    expect(logPage).toHaveBeenCalled();
  });

  it("commits with Ctrl+Enter", async () => {
    const user = userEvent.setup();
    vi.mocked(commitRepo).mockResolvedValue({ hash: "bbbb0000", subject: "mi mensaje" });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByRole("button", { name: "File status" }));
    await user.type(screen.getByLabelText("Commit message"), "mi mensaje");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(commitRepo).toHaveBeenCalledWith("/tmp/mi-repo", "mi mensaje", false);
  });

  it("does not trigger shortcuts while typing in a field", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByRole("button", { name: "File status" }));
    const input = await screen.findByLabelText("Commit message");
    await user.type(input, "?");

    expect(input).toHaveValue("?");
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("sets the window title with the repo path", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(setWindowTitle).toHaveBeenCalledWith("OpenGit");

    await user.click(screen.getByRole("button", { name: "Choose folder" }));

    expect(setWindowTitle).toHaveBeenLastCalledWith("/tmp/mi-repo");
  });

  it("warns in Output if the title cannot be set", async () => {
    // Regression: the core:window:allow-set-title permission was missing and the
    // error was swallowed silently, so the title was never actually set.
    vi.mocked(setWindowTitle).mockRejectedValueOnce(new Error("window.set_title not allowed"));
    useUiStore.setState({ outputOpen: true });
    render(<App />);

    expect(await screen.findByText(/Could not set the window title/)).toBeInTheDocument();
  });

  it("the change count lives in the Commit badge", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByRole("button", { name: "File status" }));

    const toolbar = screen.getByRole("banner");
    expect(within(toolbar).getByRole("button", { name: /Commit/ })).toHaveTextContent("1");
  });

  it("routes native menu clicks to their actions", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();
    vi.mocked(listRefs).mockClear();

    act(() => menuMock.handler?.("view-status"));
    expect(useUiStore.getState().activeView).toBe("status");

    act(() => menuMock.handler?.("refresh"));
    expect(listRefs).toHaveBeenCalledWith("/tmp/mi-repo");

    act(() => menuMock.handler?.("toggle-output"));
    expect(screen.getByRole("region", { name: "Output" })).toBeInTheDocument();
  });
});
