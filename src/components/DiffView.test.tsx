import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import { diffFile, diffNumstat, discardSelection } from "../lib/bridge/diff";
import { statusRepo } from "../lib/bridge/status";
import type { RepoInfo, StatusReport } from "../lib/bridge/types";
import { useDiffStore } from "../lib/stores/diff";
import { useRepoStore } from "../lib/stores/repo";
import { DiffView } from "./DiffView";

vi.mock("./DiffEditor", () => ({
  DiffEditor: () => <div data-testid="diff-editor" />,
}));

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn().mockResolvedValue(true),
}));

vi.mock("../lib/bridge/diff", () => ({
  diffFile: vi.fn(),
  commitFiles: vi.fn(),
  diffNumstat: vi.fn(),
  stageSelection: vi.fn(),
  discardSelection: vi.fn(),
}));

vi.mock("../lib/bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

const REPO: RepoInfo = {
  root: "/tmp/repo",
  name: "repo",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "aaaa",
  git_version: "2.50.1",
};

const REPORT: StatusReport = {
  head: "aaaa",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [
    { kind: "ordinary", xy: ".M", path: "a.txt", orig_path: null },
    { kind: "ordinary", xy: ".M", path: "bin.bin", orig_path: null },
  ],
};

const PATCH = "diff --git a/a.txt b/a.txt\n@@ -1 +1 @@\n-viejo\n+nuevo\n";

describe("DiffView", () => {
  beforeEach(() => {
    vi.mocked(statusRepo).mockResolvedValue(REPORT);
    vi.mocked(diffNumstat).mockResolvedValue([
      { path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 1 },
      { path: "bin.bin", orig_path: null, binary: true, added: null, deleted: null },
    ]);
    vi.mocked(diffFile).mockImplementation(async ({ file }) =>
      file === "bin.bin" ? "Binary files a/bin.bin and b/bin.bin differ\n" : PATCH,
    );
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useDiffStore.getState().reset();
  });

  it("lista los ficheros y muestra el editor del seleccionado", async () => {
    render(<DiffView />);

    expect(await screen.findByText("a.txt")).toBeInTheDocument();
    expect(screen.getByText("bin.bin")).toBeInTheDocument();
    expect(await screen.findByTestId("diff-editor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Side by side" })).toBeInTheDocument();
  });

  it("avisa de ficheros binarios sin editor", async () => {
    const user = userEvent.setup();
    render(<DiffView />);

    await user.click(await screen.findByText("bin.bin"));

    expect(await screen.findByText(/Binary file/)).toBeInTheDocument();
    expect(screen.queryByTestId("diff-editor")).not.toBeInTheDocument();
  });

  it("cambia a modo unificado con acciones de staging", async () => {
    const user = userEvent.setup();
    render(<DiffView />);

    await user.click(await screen.findByRole("button", { name: "Unified" }));

    expect(useDiffStore.getState().mode).toBe("unified");
    expect(await screen.findByRole("button", { name: "Stage hunk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stage file" })).toBeInTheDocument();
  });

  it("avisa cuando el parche es un puntero LFS", async () => {
    vi.mocked(diffFile).mockResolvedValue(
      [
        "diff --git a/a.txt b/a.txt",
        "@@ -1,3 +1,3 @@",
        "+version https://git-lfs.github.com/spec/v1",
        `+oid sha256:${"a".repeat(64)}`,
        "+size 4096",
      ].join("\n"),
    );
    render(<DiffView />);

    expect(await screen.findByText(/Git LFS pointer/)).toHaveTextContent("4096 bytes");
  });

  it("descarta un hunk tras confirmar", async () => {
    const user = userEvent.setup();
    vi.mocked(discardSelection).mockResolvedValue(undefined);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    render(<DiffView />);

    await user.click(await screen.findByRole("button", { name: "Unified" }));
    await user.click(await screen.findByRole("button", { name: "Discard hunk" }));

    expect(confirmDestructive).toHaveBeenCalled();
    expect(discardSelection).toHaveBeenCalledWith({
      path: "/tmp/repo",
      file: "a.txt",
      selection: { kind: "hunk", index: 0 },
    });
  });

  it("no descarta si se cancela la confirmación", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmDestructive).mockResolvedValue(false);
    render(<DiffView />);

    await user.click(await screen.findByRole("button", { name: "Unified" }));
    await user.click(await screen.findByRole("button", { name: "Discard hunk" }));

    expect(discardSelection).not.toHaveBeenCalled();
  });

  it("oculta stage y discard con el diff invertido", async () => {
    const user = userEvent.setup();
    render(<DiffView />);

    await user.click(await screen.findByRole("button", { name: "Unified" }));
    expect(await screen.findByRole("button", { name: "Stage hunk" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reverse" }));

    expect(screen.queryByRole("button", { name: "Stage hunk" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard hunk" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stage file" })).not.toBeInTheDocument();
  });
});
