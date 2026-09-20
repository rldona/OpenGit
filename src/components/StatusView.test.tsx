import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import { discardPath, stagePath, statusRepo } from "../lib/bridge/status";
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

  it("muestra las secciones con sus ficheros", async () => {
    render(<StatusView />);

    expect(await screen.findByRole("heading", { name: /Staged/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Unstaged/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Untracked/ })).toBeInTheDocument();
    expect(screen.getByText("modificado.txt")).toBeInTheDocument();
    expect(screen.getByText("nuevo.txt")).toBeInTheDocument();
  });

  it("hace stage de un fichero modificado", async () => {
    const user = userEvent.setup();
    render(<StatusView />);

    const rows = await screen.findAllByText("Stage");
    await user.click(rows[0]);

    expect(stagePath).toHaveBeenCalledWith("/tmp/repo", "modificado.txt", null);
  });

  it("solo descarta si se confirma", async () => {
    const user = userEvent.setup();
    render(<StatusView />);

    vi.mocked(confirmDestructive).mockResolvedValue(false);
    await user.click((await screen.findAllByText("Discard"))[0]);
    expect(discardPath).not.toHaveBeenCalled();

    vi.mocked(confirmDestructive).mockResolvedValue(true);
    await user.click(screen.getAllByText("Discard")[0]);
    expect(discardPath).toHaveBeenCalledWith("/tmp/repo", "modificado.txt", null);
  });

  it("avisa si el repo usa LFS y git-lfs no está instalado", async () => {
    useExtrasStore.setState({ lfs: { installed: false, version: null, configured: true } });
    render(<StatusView />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Git LFS but git-lfs is not installed",
    );
  });

  it("agrupa por directorios en modo árbol y cambia a lista", async () => {
    const user = userEvent.setup();
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [{ kind: "ordinary", xy: ".M", path: "src/a.txt", orig_path: null }],
    });
    render(<StatusView />);

    expect(await screen.findByRole("button", { name: /src\// })).toBeInTheDocument();
    expect(screen.getByText("a.txt")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "List" }));

    expect(screen.getByText("src/a.txt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /src\// })).not.toBeInTheDocument();
  });

  it("no avisa si Git LFS está instalado", async () => {
    useExtrasStore.setState({
      lfs: { installed: true, version: "git-lfs/3.5.1", configured: true },
    });
    render(<StatusView />);

    await screen.findAllByText("Staged");
    expect(screen.queryByText(/git-lfs is not installed/)).not.toBeInTheDocument();
  });
});
