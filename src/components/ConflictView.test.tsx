import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readConflictFile, resolveConflict } from "../lib/bridge/conflict";
import { statusRepo } from "../lib/bridge/status";
import type { RepoInfo, StatusReport } from "../lib/bridge/types";
import { useConflictStore } from "../lib/stores/conflict";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
import { ConflictView } from "./ConflictView";

vi.mock("../lib/bridge/conflict", () => ({
  readConflictFile: vi.fn(),
  resolveConflict: vi.fn(),
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
  entries: [{ kind: "unmerged", xy: "UU", path: "a.txt", orig_path: null }],
};

const CONTENT = ["comun", "<<<<<<< HEAD", "nuestra", "=======", "suya", ">>>>>>> feature", ""].join(
  "\n",
);

describe("ConflictView", () => {
  beforeEach(() => {
    vi.mocked(readConflictFile).mockResolvedValue({ content: CONTENT, binary: false });
    vi.mocked(resolveConflict).mockResolvedValue(undefined);
    vi.mocked(statusRepo).mockResolvedValue(REPORT);
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useConflictStore.getState().reset();
    useStatusStore.getState().reset();
    useStatusStore.setState({ root: REPO.root, report: REPORT });
  });

  it("abre el primer conflicto y muestra ours/theirs", async () => {
    render(<ConflictView />);

    expect(await screen.findByText("Ours (HEAD)")).toBeInTheDocument();
    expect(screen.getByText("Theirs (feature)")).toBeInTheDocument();
    expect(screen.getByText("nuestra")).toBeInTheDocument();
    expect(screen.getByText("suya")).toBeInTheDocument();
  });

  it("solo permite guardar cuando todo está resuelto", async () => {
    const user = userEvent.setup();
    render(<ConflictView />);

    const saveButton = await screen.findByRole("button", { name: "Save and stage" });
    expect(saveButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Take theirs" }));
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    expect(resolveConflict).toHaveBeenCalledWith("/tmp/repo", "a.txt", "comun\nsuya\n");
  });

  it("permite deshacer la elección de un bloque", async () => {
    const user = userEvent.setup();
    render(<ConflictView />);

    await user.click(await screen.findByRole("button", { name: "Take ours" }));
    expect(screen.getByRole("button", { name: "Save and stage" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Save and stage" })).toBeDisabled();
  });
});
