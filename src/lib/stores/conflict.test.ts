import { beforeEach, describe, expect, it, vi } from "vitest";
import { readConflictFile, resolveConflict } from "../bridge/conflict";
import { statusRepo } from "../bridge/status";
import type { StatusReport } from "../bridge/types";
import { useConflictStore } from "./conflict";
import { useUiStore } from "./ui";

vi.mock("../bridge/conflict", () => ({
  readConflictFile: vi.fn(),
  resolveConflict: vi.fn(),
}));

vi.mock("../bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

const CONTENT = ["comun", "<<<<<<< HEAD", "nuestra", "=======", "suya", ">>>>>>> feature", ""].join(
  "\n",
);

const CLEAN: StatusReport = {
  head: "a",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [],
};

describe("useConflictStore", () => {
  beforeEach(() => {
    useConflictStore.getState().reset();
    useUiStore.setState({ outputLines: [] });
    vi.mocked(readConflictFile).mockResolvedValue({ content: CONTENT, binary: false });
    vi.mocked(resolveConflict).mockResolvedValue(undefined);
    vi.mocked(statusRepo).mockResolvedValue(CLEAN);
  });

  it("abre el fichero y parsea sus bloques", async () => {
    await useConflictStore.getState().open("/tmp/repo", "a.txt");

    expect(useConflictStore.getState().blocks).toHaveLength(3);
    expect(useConflictStore.getState().file).toBe("a.txt");
  });

  it("detecta binarios sin bloques", async () => {
    vi.mocked(readConflictFile).mockResolvedValue({ content: "", binary: true });

    await useConflictStore.getState().open("/tmp/repo", "bin.dat");

    expect(useConflictStore.getState().binary).toBe(true);
    expect(useConflictStore.getState().blocks).toHaveLength(0);
  });

  it("rechaza guardar con bloques sin resolver", async () => {
    await useConflictStore.getState().open("/tmp/repo", "a.txt");

    const ok = await useConflictStore.getState().save("/tmp/repo");

    expect(ok).toBe(false);
    expect(useConflictStore.getState().error).toContain("Resolve all blocks");
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it("guarda el contenido resuelto y refresca el status", async () => {
    await useConflictStore.getState().open("/tmp/repo", "a.txt");
    useConflictStore.getState().choose(0, "theirs");

    const ok = await useConflictStore.getState().save("/tmp/repo");

    expect(ok).toBe(true);
    expect(resolveConflict).toHaveBeenCalledWith("/tmp/repo", "a.txt", "comun\nsuya\n");
    expect(statusRepo).toHaveBeenCalledWith("/tmp/repo");
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Resolved a.txt");
    expect(useUiStore.getState().outputLines.join("\n")).toContain("All conflicts resolved");
  });

  it("avisa si no hay marcadores de conflicto", async () => {
    vi.mocked(readConflictFile).mockResolvedValue({ content: "sin marcadores\n", binary: false });
    await useConflictStore.getState().open("/tmp/repo", "a.txt");

    const ok = await useConflictStore.getState().save("/tmp/repo");

    expect(ok).toBe(false);
    expect(useConflictStore.getState().error).toContain("No conflict markers");
  });

  it("permite deshacer una elección", async () => {
    await useConflictStore.getState().open("/tmp/repo", "a.txt");
    useConflictStore.getState().choose(0, "ours");

    useConflictStore.getState().undecide(0);

    expect(useConflictStore.getState().choices).toEqual({});
  });
});
