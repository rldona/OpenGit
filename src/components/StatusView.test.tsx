import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import { discardPath, stagePath, statusRepo } from "../lib/bridge/status";
import type { RepoInfo, StatusReport } from "../lib/bridge/types";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
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
    await user.click((await screen.findAllByText("Descartar"))[0]);
    expect(discardPath).not.toHaveBeenCalled();

    vi.mocked(confirmDestructive).mockResolvedValue(true);
    await user.click(screen.getAllByText("Descartar")[0]);
    expect(discardPath).toHaveBeenCalledWith("/tmp/repo", "modificado.txt", null);
  });
});
