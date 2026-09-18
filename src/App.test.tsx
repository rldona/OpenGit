import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { getAppVersion } from "./lib/bridge/core";
import { pickDirectory } from "./lib/bridge/dialog";
import { subscribeRepoEvents } from "./lib/bridge/events";
import { listRefs, logPage } from "./lib/bridge/log";
import { openRepo, recentRepos } from "./lib/bridge/repo";
import { commitFiles, diffFile, diffNumstat } from "./lib/bridge/diff";
import { statusRepo } from "./lib/bridge/status";
import type { Commit, RepoInfo, StatusReport } from "./lib/bridge/types";
import { useDiffStore } from "./lib/stores/diff";
import { useLogStore } from "./lib/stores/log";
import { useRepoStore } from "./lib/stores/repo";
import { useStatusStore } from "./lib/stores/status";
import { useUiStore } from "./lib/stores/ui";

vi.mock("./lib/bridge/core", () => ({
  getAppVersion: vi.fn(),
}));

vi.mock("./lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn(),
}));

vi.mock("./lib/bridge/repo", () => ({
  gitVersion: vi.fn(),
  openRepo: vi.fn(),
  recentRepos: vi.fn(),
  removeRecentRepo: vi.fn(),
  closeRepo: vi.fn(),
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

vi.mock("./lib/bridge/events", () => ({
  subscribeRepoEvents: vi.fn().mockResolvedValue([]),
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
  repoOpState: vi.fn().mockResolvedValue({ merge: false, rebase: false, cherry_pick: false }),
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
    useRepoStore.setState({ repo: null, recents: [], loading: false, error: null });
    useLogStore.getState().reset();
    useStatusStore.getState().reset();
    useDiffStore.getState().reset();
    useUiStore.setState({
      outputOpen: true,
      outputLines: ["OpenGit listo."],
      activeView: "history",
    });
  });

  it("muestra el estado vacío y la versión del núcleo", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Sin repositorio abierto" })).toBeInTheDocument();
    expect(await screen.findByText("núcleo v0.1.0")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Salida" })).toBeInTheDocument();
  });

  it("abre el repositorio elegido y muestra el historial", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Seleccionar carpeta" }));

    expect(openRepo).toHaveBeenCalledWith("/tmp/mi-repo");
    expect(await screen.findByText("commit de prueba")).toBeInTheDocument();
    expect(subscribeRepoEvents).toHaveBeenCalled();
    expect(await screen.findByText(/Repositorio abierto: mi-repo/)).toBeInTheDocument();
  });

  it("cambia a la vista File status y muestra los cambios", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Seleccionar carpeta" }));
    await user.click(await screen.findByRole("button", { name: "File status" }));

    expect((await screen.findAllByRole("heading", { name: /Staged/ })).length).toBeGreaterThan(0);
    expect(screen.getAllByText("staged.txt").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Commit" })).toBeInTheDocument();
  });

  it("selecciona un commit y muestra su detalle", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Seleccionar carpeta" }));
    await user.click(await screen.findByText("commit de prueba"));

    expect(screen.getByRole("complementary", { name: "Detalle del commit" })).toBeInTheDocument();
    expect(screen.getByText("aaaa0000")).toBeInTheDocument();
  });

  it("abre el diff de un commit desde el detalle", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Seleccionar carpeta" }));
    await user.click(await screen.findByText("commit de prueba"));
    await user.click(screen.getByRole("button", { name: "Ver diff" }));

    expect(commitFiles).toHaveBeenCalledWith("/tmp/mi-repo", "aaaa0000");
    expect(await screen.findByTestId("diff-editor")).toBeInTheDocument();
    expect(screen.getByText("a.txt")).toBeInTheDocument();
  });

  it("alterna el panel de salida", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Salida" }));

    expect(screen.queryByRole("region", { name: "Salida" })).not.toBeInTheDocument();
  });
});
