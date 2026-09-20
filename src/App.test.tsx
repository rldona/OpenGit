import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { getAppVersion } from "./lib/bridge/core";
import { pickDirectory } from "./lib/bridge/dialog";
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
import type { Commit, RepoInfo, StatusReport } from "./lib/bridge/types";
import { useDiffStore } from "./lib/stores/diff";
import { useCommitStore } from "./lib/stores/commit";
import { useExtrasStore } from "./lib/stores/extras";
import { useLogStore } from "./lib/stores/log";
import { useRepoStore } from "./lib/stores/repo";
import { useStatusStore } from "./lib/stores/status";
import { useThemeStore } from "./lib/stores/theme";
import { useUiStore } from "./lib/stores/ui";
import { THEME_STORAGE_KEY } from "./lib/theme";

vi.mock("./lib/bridge/core", () => ({
  getAppVersion: vi.fn(),
}));

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

describe("App", () => {
  beforeEach(() => {
    vi.mocked(getAppVersion).mockResolvedValue("0.1.0");
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
      outputOpen: true,
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

  it("muestra el estado vacío y la versión del núcleo", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "No repository open" })).toBeInTheDocument();
    expect(await screen.findByText("core v0.1.0")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Output" })).toBeInTheDocument();
  });

  it("abre el repositorio elegido y muestra el historial", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));

    expect(openRepo).toHaveBeenCalledWith("/tmp/mi-repo");
    expect(await screen.findByText("commit de prueba")).toBeInTheDocument();
    expect(subscribeRepoEvents).toHaveBeenCalled();
    expect(await screen.findByText(/Repository opened: mi-repo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fetch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Push" })).toBeInTheDocument();
    expect(screen.getByText("Graph")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Commit")).toBeInTheDocument();
    expect(screen.getByText("Author")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
  });

  it("abre el editor de conflictos desde File status", async () => {
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

  it("muestra el banner de operación con Abort y Continue", async () => {
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

  it("busca commits por mensaje desde la toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await screen.findByText("commit de prueba");
    await user.type(screen.getByLabelText("Search message"), "feat");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(logPage).toHaveBeenLastCalledWith("/tmp/mi-repo", 0, 200, null, {
      grep: "feat",
      author: "",
      path: "",
    });
  });

  it("cambia a la vista File status y muestra los cambios", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByRole("button", { name: "File status" }));

    expect((await screen.findAllByRole("heading", { name: /Staged/ })).length).toBeGreaterThan(0);
    expect(screen.getAllByText("staged.txt").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Commit" })).toBeInTheDocument();
  });

  it("selecciona un commit y muestra su detalle", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByText("commit de prueba"));

    expect(screen.getByRole("complementary", { name: "Commit details" })).toBeInTheDocument();
    expect(screen.getByText("aaaa0000")).toBeInTheDocument();
  });

  it("ofrece cherry-pick, revert y reset en el detalle del commit", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByText("commit de prueba"));

    expect(screen.getByRole("button", { name: "Cherry-pick" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revert" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to here" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Interactive rebase from here" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cherry-pick" }));

    expect(cherryPick).toHaveBeenCalledWith("/tmp/mi-repo", "aaaa0000");
  });

  it("abre el diff de un commit desde el detalle", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByText("commit de prueba"));
    await user.click(screen.getByRole("button", { name: "View diff" }));

    expect(commitFiles).toHaveBeenCalledWith("/tmp/mi-repo", "aaaa0000");
    expect(await screen.findByTestId("diff-editor")).toBeInTheDocument();
    expect(screen.getByText("a.txt")).toBeInTheDocument();
  });

  it("alterna el panel de salida", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Output" }));

    expect(screen.queryByRole("region", { name: "Output" })).not.toBeInTheDocument();
  });

  it("cambia el tema y lo aplica al documento", async () => {
    const user = userEvent.setup();
    render(<App />);

    const select = screen.getByRole("combobox", { name: "Theme" });
    expect(select).toHaveValue("system");

    await user.selectOptions(select, "light");

    expect(select).toHaveValue("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    await user.selectOptions(select, "dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("abre la ayuda de atajos con ? y la cierra con Esc", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("?");

    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByText("Ctrl+O")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("abre y cierra la ayuda desde el botón de la toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("abre el selector de repositorio con Ctrl+O", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("{Control>}o{/Control}");

    expect(pickDirectory).toHaveBeenCalled();
  });

  it("refresca status, refs e historial con Ctrl+R", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await screen.findByText("commit de prueba");
    vi.mocked(listRefs).mockClear();

    await user.keyboard("{Control>}r{/Control}");

    expect(listRefs).toHaveBeenCalledWith("/tmp/mi-repo");
    expect(logPage).toHaveBeenCalled();
  });

  it("enfoca la búsqueda del historial con Ctrl+F", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByRole("button", { name: "File status" }));
    await user.keyboard("{Control>}f{/Control}");

    expect(await screen.findByLabelText("Search message")).toHaveFocus();
  });

  it("hace commit con Ctrl+Enter", async () => {
    const user = userEvent.setup();
    vi.mocked(commitRepo).mockResolvedValue({ hash: "bbbb0000", subject: "mi mensaje" });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByRole("button", { name: "File status" }));
    await user.type(screen.getByLabelText("Commit message"), "mi mensaje");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(commitRepo).toHaveBeenCalledWith("/tmp/mi-repo", "mi mensaje", false);
  });

  it("no dispara atajos mientras se escribe en un campo", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    const input = await screen.findByLabelText("Search message");
    await user.type(input, "?");

    expect(input).toHaveValue("?");
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("fija el título de la ventana con la ruta del repo", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(setWindowTitle).toHaveBeenCalledWith("OpenGit");

    await user.click(screen.getByRole("button", { name: "Choose folder" }));

    expect(setWindowTitle).toHaveBeenLastCalledWith("/tmp/mi-repo");
  });

  it("muestra rama, cambios y versión en la barra de estado", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByRole("button", { name: "File status" }));

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("main")).toBeInTheDocument();
    expect(await within(footer).findByText("1 change(s)")).toBeInTheDocument();
    expect(within(footer).getByText("core v0.1.0")).toBeInTheDocument();
  });

  it("enruta los clics del menú nativo a sus acciones", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await screen.findByText("commit de prueba");
    vi.mocked(listRefs).mockClear();

    act(() => menuMock.handler?.("view-status"));
    expect(useUiStore.getState().activeView).toBe("status");

    act(() => menuMock.handler?.("refresh"));
    expect(listRefs).toHaveBeenCalledWith("/tmp/mi-repo");

    act(() => menuMock.handler?.("toggle-output"));
    expect(screen.queryByRole("region", { name: "Output" })).not.toBeInTheDocument();
  });
});
