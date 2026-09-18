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

/** La fila de la lista: el asunto se repite en el panel de detalle. */
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

  it("muestra el estado vacío con el panel de Output oculto por defecto", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "No repository open" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Output" })).not.toBeInTheDocument();
  });

  it("abre el repositorio elegido y muestra el historial", async () => {
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

  it("el botón Pull abre el diálogo de opciones sin lanzar el job", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    await user.click(screen.getByRole("button", { name: "Pull" }));

    expect(screen.getByRole("dialog", { name: "Pull" })).toBeInTheDocument();
    expect(startRemoteJob).not.toHaveBeenCalled();
  });

  it("el botón Fetch abre el diálogo de opciones", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    await user.click(screen.getByRole("button", { name: "Fetch" }));

    expect(screen.getByRole("dialog", { name: "Fetch" })).toBeInTheDocument();
  });

  it("muestra la fila Uncommitted changes y abre su diff", async () => {
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
    await user.click(await findCommitRow());

    expect(screen.getByRole("region", { name: "Commit details" })).toBeInTheDocument();
    expect(screen.getByText("aaaa0000")).toBeInTheDocument();
    expect(screen.getByText(/Cuerpo del commit\./)).toHaveTextContent("Segunda línea.");
  });

  it("ofrece cherry-pick, revert y reset en el menú contextual del commit", async () => {
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

  it("muestra el diff del commit en la zona inferior sin salir del historial", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await findCommitRow());

    expect(await screen.findAllByText("a.txt")).not.toHaveLength(0);
    expect(commitFiles).toHaveBeenCalledWith("/tmp/mi-repo", "aaaa0000");
    // Sigue siendo la vista de historial: la fila del commit no desaparece.
    expect(useUiStore.getState().activeView).toBe("history");
    expect(document.querySelector(".commit-subject")).toHaveTextContent("commit de prueba");
  });

  it("el desplegable de rama solo lista ramas locales, no las del remoto", async () => {
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

    // Un repo real tiene miles de ramas remotas: volcarlas aquí inutiliza el
    // desplegable.
    expect(within(select).getByRole("option", { name: "main" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "feature" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: /origin\// })).not.toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "v1.0.0" })).not.toBeInTheDocument();
  });

  it("no reserva columna de refs en los commits que no tienen ninguna", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    // COMMIT lleva "HEAD -> main", así que sí debe pintarse el bloque de refs.
    expect(document.querySelector(".commit-refs")).not.toBeNull();

    vi.mocked(logPage).mockResolvedValue([{ ...COMMIT, refs: [] }]);
    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    // Sin refs no se pinta el hueco: el asunto pega con el grafo.
    await waitFor(() => expect(document.querySelector(".commit-refs")).toBeNull());
  });

  it("redimensiona las columnas de la tabla y guarda el ancho", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    const resizer = screen.getByRole("separator", { name: "Resize Author column" });
    const author = document.querySelector(".commit-author") as HTMLElement;
    const inicial = author.style.width;

    // Con el teclado, que en jsdom no hay arrastre de puntero de verdad.
    resizer.focus();
    await user.keyboard("{ArrowLeft}");

    expect(author.style.width).not.toBe(inicial);
    expect(localStorage.getItem("opengit.columns.commit-table")).toContain("author");
  });

  it("marca los commits entrantes en el historial", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await findCommitRow();

    act(() => useRefsStore.setState({ incoming: ["aaaa0000"] }));

    expect(screen.getByTitle("Incoming commit")).toBeInTheDocument();
  });

  it("abre el menú contextual de un commit y ejecuta la acción", async () => {
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

  it("alterna el panel de salida desde Settings", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole("region", { name: "Output" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Toggle output panel" }));
    expect(screen.getByRole("region", { name: "Output" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Toggle output panel" }));
    expect(screen.queryByRole("region", { name: "Output" })).not.toBeInTheDocument();
  });

  it("cambia el tema y lo aplica al documento", async () => {
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

  it("abre la ayuda de atajos con ? y la cierra con Esc", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("?");

    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByText("Ctrl+O")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("abre y cierra la ayuda desde Settings", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Settings" }));
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
    await findCommitRow();
    vi.mocked(listRefs).mockClear();

    await user.keyboard("{Control>}r{/Control}");

    expect(listRefs).toHaveBeenCalledWith("/tmp/mi-repo");
    expect(logPage).toHaveBeenCalled();
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
    await user.click(await screen.findByRole("button", { name: "File status" }));
    const input = await screen.findByLabelText("Commit message");
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

  it("avisa en Output si no se puede fijar el título", async () => {
    // Regresión: faltaba el permiso core:window:allow-set-title y el error
    // se tragaba en silencio, así que el título nunca se fijaba de verdad.
    vi.mocked(setWindowTitle).mockRejectedValueOnce(new Error("window.set_title not allowed"));
    useUiStore.setState({ outputOpen: true });
    render(<App />);

    expect(await screen.findByText(/Could not set the window title/)).toBeInTheDocument();
  });

  it("el recuento de cambios vive en el badge de Commit", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Choose folder" }));
    await user.click(await screen.findByRole("button", { name: "File status" }));

    const toolbar = screen.getByRole("banner");
    expect(within(toolbar).getByRole("button", { name: /Commit/ })).toHaveTextContent("1");
  });

  it("enruta los clics del menú nativo a sus acciones", async () => {
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
