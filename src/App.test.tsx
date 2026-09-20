import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { check } from "@tauri-apps/plugin-updater";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { initialRepo } from "./lib/bridge/app";
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
import { commitFiles, compareNumstat, diffFile, diffNumstat } from "./lib/bridge/diff";
import { statusRepo } from "./lib/bridge/status";
import { stashList } from "./lib/bridge/stash";
import type { Commit, RepoInfo, StatusReport } from "./lib/bridge/types";
import { useDiffStore } from "./lib/stores/diff";
import { useUpdateStore } from "./lib/stores/update";
import { useCommitStore } from "./lib/stores/commit";
import { useExtrasStore } from "./lib/stores/extras";
import { useLogStore } from "./lib/stores/log";
import { useRepoStore } from "./lib/stores/repo";
import { useSettingsStore } from "./lib/stores/settings";
import { useStatusStore } from "./lib/stores/status";
import { saveStoredSession } from "./lib/tabs";
import { useRefsStore } from "./lib/stores/refs";
import { useThemeStore } from "./lib/stores/theme";
import { useUiStore } from "./lib/stores/ui";
import { THEME_STORAGE_KEY } from "./lib/theme";

vi.mock("./lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn().mockResolvedValue(true),
}));

vi.mock("./lib/bridge/app", () => ({
  initialRepo: vi.fn().mockResolvedValue(null),
  openRepoInNewWindow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lib/bridge/opener", () => ({
  openExternal: vi.fn().mockResolvedValue(undefined),
  openTerminal: vi.fn().mockResolvedValue(undefined),
  revealInFileManager: vi.fn().mockResolvedValue(undefined),
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
  remoteAdd: vi.fn().mockResolvedValue(undefined),
  remoteSetUrl: vi.fn().mockResolvedValue(undefined),
  remoteRename: vi.fn().mockResolvedValue(undefined),
  remoteRemove: vi.fn().mockResolvedValue(undefined),
  initRepo: vi.fn().mockResolvedValue(undefined),
  gitignoreTemplates: vi.fn().mockResolvedValue([]),
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
  compareNumstat: vi.fn().mockResolvedValue([]),
  compareFile: vi.fn().mockResolvedValue(""),
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

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn().mockResolvedValue(null),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn().mockResolvedValue(undefined),
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
    useRepoStore.setState({ repo: null, recents: [], openTabs: [], loading: false, error: null });
    useUpdateStore.getState().reset();
    useSettingsStore.setState({ restoreTabs: false });
    vi.mocked(initialRepo).mockResolvedValue(null);
    // The updater plugin is mocked; the startup check never touches the network.
    vi.mocked(check).mockReset();
    vi.mocked(check).mockResolvedValue(null);
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
      searchFocusRequest: 0,
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

  it("offers Clone and Create from the home screen", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Clone Repository…" }));
    expect(screen.getByRole("dialog", { name: "Clone Repository" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Create Repository…" }));
    expect(screen.getByRole("dialog", { name: "Create Repository" })).toBeInTheDocument();
  });

  it("lists recent projects on the home and opens one directly", async () => {
    const user = userEvent.setup();
    render(<App />);

    const recent = await screen.findByRole("button", { name: /^mi-repo/ });
    expect(recent).toHaveAttribute("title", "/tmp/mi-repo");
    expect(screen.getByText("Recent Projects")).toBeInTheDocument();

    await user.click(recent);

    expect(openRepo).toHaveBeenCalledWith("/tmp/mi-repo");
  });

  it("restores the previous session when the preference is on", async () => {
    useSettingsStore.setState({ restoreTabs: true });
    saveStoredSession([{ path: "/tmp/mi-repo" }], "/tmp/mi-repo");
    render(<App />);

    await waitFor(() => expect(openRepo).toHaveBeenCalledWith("/tmp/mi-repo"));
    expect(await screen.findByRole("tab", { name: "mi-repo" })).toBeInTheDocument();
  });

  it("does not flash the home while restoring the session", async () => {
    useSettingsStore.setState({ restoreTabs: true });
    saveStoredSession([{ path: "/tmp/mi-repo" }], "/tmp/mi-repo");
    let resolveOpen: ((repo: RepoInfo) => void) | undefined;
    vi.mocked(openRepo).mockImplementation(
      () =>
        new Promise<RepoInfo>((resolve) => {
          resolveOpen = resolve;
        }),
    );

    render(<App />);

    // The recents home must not appear while the stored repo is opening.
    expect(screen.queryByRole("heading", { name: "No repository open" })).not.toBeInTheDocument();

    await waitFor(() => expect(resolveOpen).toBeDefined());
    resolveOpen?.(REPO);
    expect(await screen.findByRole("tab", { name: "mi-repo" })).toBeInTheDocument();
  });

  it("opens the repository a new window was created for", async () => {
    vi.mocked(initialRepo).mockResolvedValue("/tmp/mi-repo");
    render(<App />);

    await waitFor(() => expect(openRepo).toHaveBeenCalledWith("/tmp/mi-repo"));
  });

  it("opens the chosen repository and shows the history", async () => {
    const user = userEvent.setup();
    useUiStore.setState({ outputOpen: true });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));

    expect(openRepo).toHaveBeenCalledWith("/tmp/mi-repo");
    expect(await screen.findAllByText("commit de prueba")).not.toHaveLength(0);
    // The pending changes must show up without pressing Refresh (status loads
    // when the repo opens, not only when the Status view mounts).
    expect(await screen.findByText("Uncommitted changes")).toBeInTheDocument();
    // With changes, the working tree row is preselected and its panels show.
    expect(await screen.findByRole("region", { name: "Uncommitted changes" })).toBeInTheDocument();
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

  it("shows the tab strip with one repo plus the add button", async () => {
    const other: RepoInfo = { ...REPO, root: "/tmp/other", name: "other" };
    useRepoStore.setState({
      repo: REPO,
      openTabs: [{ path: REPO.root, name: REPO.name, opened_at: 1 }],
      loading: false,
      error: null,
    });
    render(<App />);

    // A single open repo renders its tab with the add button, no Recents.
    const tablist = await screen.findByRole("tablist", { name: "Open repositories" });
    expect(within(tablist).getByRole("tab", { name: "mi-repo" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      within(tablist).getByRole("button", { name: "Open another repository" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Recents")).not.toBeInTheDocument();

    act(() => {
      useRepoStore.setState({
        openTabs: [
          { path: REPO.root, name: REPO.name, opened_at: 1 },
          { path: other.root, name: other.name, opened_at: 2 },
        ],
      });
    });

    expect(within(tablist).getByRole("tab", { name: "other" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    // The strip sits between the toolbar and the workspace content.
    expect(tablist.previousElementSibling?.classList.contains("toolbar")).toBe(true);
    expect(tablist.nextElementSibling?.classList.contains("workspace")).toBe(true);
  });

  it("switches tabs with the keyboard shortcuts", async () => {
    const other: RepoInfo = { ...REPO, root: "/tmp/other", name: "other" };
    vi.mocked(openRepo).mockImplementation(async (path: string) =>
      path === other.root ? other : REPO,
    );
    useRepoStore.setState({ repo: null, openTabs: [], loading: false, error: null });
    render(<App />);

    await useRepoStore.getState().open(REPO.root);
    await useRepoStore.getState().open(other.root);
    expect(useRepoStore.getState().repo?.root).toBe(other.root);

    const tablist = await screen.findByRole("tablist", { name: "Open repositories" });
    fireEvent.keyDown(document, { key: "[", ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(useRepoStore.getState().repo?.root).toBe(REPO.root));

    fireEvent.keyDown(document, { key: "]", ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(useRepoStore.getState().repo?.root).toBe(other.root));
    expect(tablist).toBeInTheDocument();
  });

  it("searches the history by message and clears back to the full log", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await screen.findAllByText("commit de prueba");

    const input = screen.getByRole("searchbox", { name: "Search message" });
    await user.type(input, "prueba{Enter}");

    await waitFor(() =>
      expect(logPage).toHaveBeenLastCalledWith("/tmp/mi-repo", 0, 200, null, {
        grep: "prueba",
        author: "",
        path: "",
      }),
    );
    expect(await screen.findByText("1 result")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() =>
      expect(logPage).toHaveBeenLastCalledWith("/tmp/mi-repo", 0, 200, null, null),
    );
    expect(screen.queryByText("1 result")).not.toBeInTheDocument();
    expect(useLogStore.getState().search).toBeNull();
  });

  it("focuses the search field with mod+f", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await screen.findAllByText("commit de prueba");

    fireEvent.keyDown(document, { key: "f", ctrlKey: true, metaKey: true });

    await waitFor(() =>
      expect(screen.getByRole("searchbox", { name: "Search message" })).toHaveFocus(),
    );
  });

  it("shows the no-results state when the search matches nothing", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await screen.findAllByText("commit de prueba");

    vi.mocked(logPage).mockResolvedValue([]);
    await user.type(screen.getByRole("searchbox", { name: "Search message" }), "nada{Enter}");

    expect(await screen.findByText("No commits match the search")).toBeInTheDocument();
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
    const statusFiles = document.querySelector(".status-files") as HTMLElement;
    await user.click(await within(statusFiles).findByText("conflicto.txt"));

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
    useRepoStore.setState({ repo: REPO, recents: [], openTabs: [], loading: false, error: null });
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

  it("the Merge button opens the merge window on the log tab", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    await user.click(screen.getByRole("button", { name: "Merge" }));

    expect(screen.getByRole("dialog", { name: "Merge" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Merge From Log" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Merge Fetched" })).toBeInTheDocument();
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
    expect(
      document.querySelector(".commit-row:not(.worktree-row) .commit-subject"),
    ).toHaveTextContent("commit de prueba");
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

  it("opens the Settings modal on the Appearance tab without a repo", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Appearance" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("changes the theme and applies it to the document on OK", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const select = screen.getByRole("combobox", { name: "Theme" });
    expect(select).toHaveValue("system");

    await user.selectOptions(select, "light");
    expect(select).toHaveValue("light");
    // Cancel would discard it: the theme is applied on OK.
    expect(document.documentElement.dataset.theme).toBe("dark");

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
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

  it("checks for updates from the native menu and offers to restart", async () => {
    const user = userEvent.setup();
    const update = {
      version: "0.4.0",
      download: vi.fn().mockResolvedValue(undefined),
      install: vi.fn().mockResolvedValue(undefined),
    };
    render(<App />);
    // Let the silent startup check finish before the manual one in this test.
    await waitFor(() => expect(useUpdateStore.getState().status).toBe("idle"));
    vi.mocked(check).mockResolvedValue(update as never);

    act(() => menuMock.handler?.("check-updates"));

    expect(await screen.findByText("OpenGit 0.4.0 is ready.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByText("OpenGit 0.4.0 is ready.")).not.toBeInTheDocument();
  });

  it("opens the Merge window from the native menu", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    act(() => menuMock.handler?.("merge"));

    expect(screen.getByRole("dialog", { name: "Merge" })).toBeInTheDocument();
  });

  it("opens the Clone dialog from the native menu", () => {
    render(<App />);

    act(() => menuMock.handler?.("clone-repo"));

    expect(screen.getByRole("dialog", { name: "Clone Repository" })).toBeInTheDocument();
  });

  it("opens the Create dialog from the native menu", () => {
    render(<App />);

    act(() => menuMock.handler?.("create-repo"));

    expect(screen.getByRole("dialog", { name: "Create Repository" })).toBeInTheDocument();
  });

  it("opens the Apply Patch dialog from the native menu", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();
    act(() => menuMock.handler?.("apply-patch"));

    expect(screen.getByRole("dialog", { name: "Apply Patch" })).toBeInTheDocument();
  });

  it("shows the file history band and returns to the full log", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    act(() => useLogStore.setState({ historyPath: "src/a.ts" }));

    expect(screen.getByText("File history:")).toBeInTheDocument();
    expect(screen.getByText("src/a.ts")).toBeInTheDocument();

    vi.mocked(logPage).mockClear();
    await user.click(screen.getByRole("button", { name: "Show full history" }));

    expect(logPage).toHaveBeenLastCalledWith("/tmp/mi-repo", 0, 200, null, null);
  });

  it("compares two commits selected with Ctrl+click", async () => {
    const user = userEvent.setup();
    vi.mocked(logPage).mockResolvedValue([
      { ...COMMIT, hash: "aaaa0000", subject: "segundo" },
      { ...COMMIT, hash: "bbbb0000", subject: "primero" },
    ]);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await screen.findAllByText("segundo");

    const rows = document.querySelectorAll<HTMLElement>(".commit-row:not(.worktree-row)");
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[0], { ctrlKey: true });
    fireEvent.click(rows[1], { ctrlKey: true });

    fireEvent.contextMenu(rows[0]);
    await user.click(screen.getByRole("menuitem", { name: "Compare selected" }));

    expect(compareNumstat).toHaveBeenCalledWith("/tmp/mi-repo", "aaaa0000", "bbbb0000");
    expect(useUiStore.getState().activeView).toBe("diff");
  });
});
