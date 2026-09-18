import { beforeEach, describe, expect, it, vi } from "vitest";
import { commitMessage, commitRepo, repoOpState } from "../bridge/commit";
import { confirmDestructive } from "../bridge/dialog";
import { listRefs, logPage } from "../bridge/log";
import { statusRepo } from "../bridge/status";
import type { StatusReport } from "../bridge/types";
import { useCommitStore } from "./commit";
import { useUiStore } from "./ui";

vi.mock("../bridge/commit", () => ({
  commitMessage: vi.fn(),
  commitRepo: vi.fn(),
  repoOpState: vi.fn(),
}));

vi.mock("../bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn(),
}));

vi.mock("../bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

vi.mock("../bridge/log", () => ({
  logPage: vi.fn(),
  listRefs: vi.fn(),
}));

const REPORT: StatusReport = {
  head: "aaaa",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [],
};

describe("useCommitStore", () => {
  beforeEach(() => {
    useCommitStore.getState().reset();
    useUiStore.setState({ outputLines: [] });
    vi.mocked(repoOpState).mockResolvedValue({ merge: false, rebase: false, cherry_pick: false });
    vi.mocked(statusRepo).mockResolvedValue(REPORT);
    vi.mocked(listRefs).mockResolvedValue([]);
    vi.mocked(logPage).mockResolvedValue([]);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    vi.mocked(commitMessage).mockResolvedValue("mensaje anterior");
  });

  it("rechaza un mensaje vacío", async () => {
    await useCommitStore.getState().load("/tmp/repo");

    const ok = await useCommitStore.getState().submit(1);

    expect(ok).toBe(false);
    expect(useCommitStore.getState().error).toBe("Write a commit message");
    expect(commitRepo).not.toHaveBeenCalled();
  });

  it("rechaza commitear sin cambios en el index", async () => {
    await useCommitStore.getState().load("/tmp/repo");
    useCommitStore.getState().setMessage("feat: algo");

    const ok = await useCommitStore.getState().submit(0);

    expect(ok).toBe(false);
    expect(useCommitStore.getState().error).toContain("Nothing staged");
    expect(commitRepo).not.toHaveBeenCalled();
  });

  it("commitea, limpia el mensaje y refresca status y grafo", async () => {
    vi.mocked(commitRepo).mockResolvedValue({ hash: "abc1234", subject: "feat: algo" });
    await useCommitStore.getState().load("/tmp/repo");
    useCommitStore.getState().setMessage("feat: algo");

    const ok = await useCommitStore.getState().submit(2);

    expect(ok).toBe(true);
    expect(commitRepo).toHaveBeenCalledWith("/tmp/repo", "feat: algo", false);
    expect(useCommitStore.getState().message).toBe("");
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Commit abc1234: feat: algo");
    expect(statusRepo).toHaveBeenCalledWith("/tmp/repo");
    expect(logPage).toHaveBeenCalledWith("/tmp/repo", 0, 200, null, null);
  });

  it("el amend pide confirmación y precarga el mensaje anterior", async () => {
    await useCommitStore.getState().load("/tmp/repo");

    await useCommitStore.getState().setAmend(true);

    expect(confirmDestructive).toHaveBeenCalled();
    expect(useCommitStore.getState().amend).toBe(true);
    expect(useCommitStore.getState().message).toBe("mensaje anterior");
  });

  it("si se cancela el amend no cambia nada", async () => {
    vi.mocked(confirmDestructive).mockResolvedValue(false);
    await useCommitStore.getState().load("/tmp/repo");

    await useCommitStore.getState().setAmend(true);

    expect(useCommitStore.getState().amend).toBe(false);
    expect(useCommitStore.getState().message).toBe("");
  });

  it("muestra la salida del hook cuando el commit falla", async () => {
    vi.mocked(commitRepo).mockRejectedValue({
      kind: "command_failed",
      exit_code: 1,
      stdout: "",
      stderr: "hook dice no",
      args: ["commit"],
    });
    await useCommitStore.getState().load("/tmp/repo");
    useCommitStore.getState().setMessage("feat: algo");

    const ok = await useCommitStore.getState().submit(1);

    expect(ok).toBe(false);
    expect(useCommitStore.getState().error).toContain("hook dice no");
  });
});
