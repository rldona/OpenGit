import { beforeEach, describe, expect, it, vi } from "vitest";
import { cherryPick, resetMixed, revertCommit } from "../bridge/history";
import { listRefs, logPage } from "../bridge/log";
import type { Commit } from "../bridge/types";
import { useLogStore } from "./log";
import { useUiStore } from "./ui";

vi.mock("../bridge/log", () => ({
  logPage: vi.fn(),
  listRefs: vi.fn(),
}));

vi.mock("../bridge/history", () => ({
  cherryPick: vi.fn(),
  revertCommit: vi.fn(),
  resetMixed: vi.fn(),
}));

vi.mock("../bridge/status", () => ({
  statusRepo: vi.fn().mockResolvedValue({
    head: "a",
    branch: "main",
    detached: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    entries: [],
  }),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

vi.mock("../bridge/refs", () => ({
  branchTracking: vi
    .fn()
    .mockResolvedValue({ current: "main", upstream: null, ahead: 0, behind: 0 }),
  checkoutRef: vi.fn(),
  createBranch: vi.fn(),
  renameBranch: vi.fn(),
  deleteBranch: vi.fn(),
}));

const COMMIT: Commit = {
  hash: "aaaa0000",
  parents: [],
  author_name: "Test",
  author_email: "test@opengit.dev",
  author_time: 1_789_725_600,
  refs: ["HEAD -> main"],
  subject: "commit de prueba",
  body: "",
};

function page(size: number, prefix: string): Commit[] {
  return Array.from({ length: size }, (_, index) => ({
    ...COMMIT,
    hash: `${prefix}${index}`,
    subject: `${prefix} ${index}`,
  }));
}

describe("useLogStore", () => {
  beforeEach(() => {
    useLogStore.getState().reset();
    vi.mocked(listRefs).mockResolvedValue([]);
    vi.mocked(logPage).mockResolvedValue([]);
  });

  it("carga la primera página y construye el layout", async () => {
    vi.mocked(logPage).mockResolvedValue([COMMIT]);

    await useLogStore.getState().load("/tmp/repo");

    expect(useLogStore.getState().commits).toHaveLength(1);
    expect(useLogStore.getState().layout.rows).toHaveLength(1);
    expect(useLogStore.getState().hasMore).toBe(false);
    expect(logPage).toHaveBeenCalledWith("/tmp/repo", 0, 200, null, null);
  });

  it("acumula páginas y mantiene el layout incremental", async () => {
    vi.mocked(logPage).mockResolvedValueOnce(page(200, "p")).mockResolvedValueOnce(page(1, "r"));

    await useLogStore.getState().load("/tmp/repo");
    expect(useLogStore.getState().hasMore).toBe(true);

    await useLogStore.getState().loadMore();

    expect(useLogStore.getState().commits).toHaveLength(201);
    expect(useLogStore.getState().layout.rows).toHaveLength(201);
    expect(useLogStore.getState().hasMore).toBe(false);
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 200, 200, null, null);
  });

  it("recarga al cambiar el filtro de rama", async () => {
    await useLogStore.getState().setFilter("/tmp/repo", "refs/heads/main");

    expect(useLogStore.getState().filter).toBe("refs/heads/main");
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, "refs/heads/main", null);
  });

  it("hace cherry-pick y refresca log, refs y status", async () => {
    vi.mocked(cherryPick).mockResolvedValue(undefined);
    useUiStore.setState({ outputLines: [] });
    await useLogStore.getState().load("/tmp/repo");
    vi.mocked(logPage).mockClear();

    await useLogStore.getState().cherryPick("/tmp/repo", "abcdef1234567890");

    expect(cherryPick).toHaveBeenCalledWith("/tmp/repo", "abcdef1234567890");
    expect(logPage).toHaveBeenCalled();
    expect(listRefs).toHaveBeenCalled();
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Cherry-picked abcdef1");
  });

  it("expone el fallo de un cherry-pick en conflicto", async () => {
    vi.mocked(cherryPick).mockRejectedValue({
      kind: "command_failed",
      exit_code: 1,
      stdout: "",
      stderr: "CONFLICT (content)",
      args: ["cherry-pick"],
    });
    await useLogStore.getState().load("/tmp/repo");

    await useLogStore.getState().cherryPick("/tmp/repo", "abcdef1234567890");

    expect(useLogStore.getState().error).toContain("CONFLICT");
  });

  it("revierte y hace reset mixed", async () => {
    vi.mocked(revertCommit).mockResolvedValue(undefined);
    vi.mocked(resetMixed).mockResolvedValue(undefined);
    await useLogStore.getState().load("/tmp/repo");

    await useLogStore.getState().revert("/tmp/repo", "abcdef1234567890");
    await useLogStore.getState().resetTo("/tmp/repo", "abcdef1234567890");

    expect(revertCommit).toHaveBeenCalled();
    expect(resetMixed).toHaveBeenCalledWith("/tmp/repo", "abcdef1234567890");
  });

  it("aplica una búsqueda y aplana el layout", async () => {
    vi.mocked(logPage).mockResolvedValue([{ ...COMMIT, parents: ["padre-fuera-de-la-busqueda"] }]);
    await useLogStore.getState().load("/tmp/repo");

    await useLogStore.getState().applySearch("/tmp/repo", {
      grep: "feat",
      author: "",
      path: "",
    });

    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, null, {
      grep: "feat",
      author: "",
      path: "",
    });
    expect(useLogStore.getState().layout.rows[0].edges).toHaveLength(0);
  });

  it("limpia la búsqueda y vuelve a cargar sin filtros", async () => {
    await useLogStore.getState().load("/tmp/repo");
    await useLogStore.getState().applySearch("/tmp/repo", {
      grep: "feat",
      author: "",
      path: "",
    });

    await useLogStore.getState().clearSearch("/tmp/repo");

    expect(useLogStore.getState().search).toEqual({ grep: "", author: "", path: "" });
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, null, null);
  });

  it("expone el error de git sin romper el estado", async () => {
    vi.mocked(logPage).mockRejectedValue({
      kind: "command_failed",
      exit_code: 128,
      stderr: "fatal: bad revision",
      args: ["log"],
    });

    await useLogStore.getState().load("/tmp/repo");

    expect(useLogStore.getState().error).toContain("git failed with code 128");
    expect(useLogStore.getState().commits).toHaveLength(0);
  });
});
