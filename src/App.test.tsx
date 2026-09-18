import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { getAppVersion } from "./lib/bridge/core";
import { pickDirectory } from "./lib/bridge/dialog";
import { listRefs, logPage } from "./lib/bridge/log";
import { openRepo, recentRepos } from "./lib/bridge/repo";
import type { Commit, RepoInfo } from "./lib/bridge/types";
import { useLogStore } from "./lib/stores/log";
import { useRepoStore } from "./lib/stores/repo";
import { useUiStore } from "./lib/stores/ui";

vi.mock("./lib/bridge/core", () => ({
  getAppVersion: vi.fn(),
}));

vi.mock("./lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
}));

vi.mock("./lib/bridge/repo", () => ({
  gitVersion: vi.fn(),
  openRepo: vi.fn(),
  recentRepos: vi.fn(),
  removeRecentRepo: vi.fn(),
}));

vi.mock("./lib/bridge/log", () => ({
  logPage: vi.fn(),
  listRefs: vi.fn(),
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
    useRepoStore.setState({ repo: null, recents: [], loading: false, error: null });
    useLogStore.getState().reset();
    useUiStore.setState({ outputOpen: true, outputLines: ["OpenGit listo."] });
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
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(await screen.findByText(/Repositorio abierto: mi-repo/)).toBeInTheDocument();
  });

  it("selecciona un commit y muestra su detalle", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Seleccionar carpeta" }));
    await user.click(await screen.findByText("commit de prueba"));

    expect(screen.getByRole("complementary", { name: "Detalle del commit" })).toBeInTheDocument();
    expect(screen.getByText("aaaa0000")).toBeInTheDocument();
  });

  it("alterna el panel de salida", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Salida" }));

    expect(screen.queryByRole("region", { name: "Salida" })).not.toBeInTheDocument();
  });
});
