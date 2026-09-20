import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRefs, logPage } from "../bridge/log";
import type { Commit } from "../bridge/types";
import { useLogStore } from "./log";

vi.mock("../bridge/log", () => ({
  logPage: vi.fn(),
  listRefs: vi.fn(),
}));

const COMMIT: Commit = {
  hash: "aaaa0000",
  parents: [],
  author_name: "Test",
  author_email: "test@opengit.dev",
  author_time: 1_789_725_600,
  refs: ["HEAD -> main"],
  subject: "commit de prueba",
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
    expect(logPage).toHaveBeenCalledWith("/tmp/repo", 0, 200, null);
  });

  it("acumula páginas y mantiene el layout incremental", async () => {
    vi.mocked(logPage).mockResolvedValueOnce(page(200, "p")).mockResolvedValueOnce(page(1, "r"));

    await useLogStore.getState().load("/tmp/repo");
    expect(useLogStore.getState().hasMore).toBe(true);

    await useLogStore.getState().loadMore();

    expect(useLogStore.getState().commits).toHaveLength(201);
    expect(useLogStore.getState().layout.rows).toHaveLength(201);
    expect(useLogStore.getState().hasMore).toBe(false);
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 200, 200, null);
  });

  it("recarga al cambiar el filtro de rama", async () => {
    await useLogStore.getState().setFilter("/tmp/repo", "refs/heads/main");

    expect(useLogStore.getState().filter).toBe("refs/heads/main");
    expect(logPage).toHaveBeenLastCalledWith("/tmp/repo", 0, 200, "refs/heads/main");
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
