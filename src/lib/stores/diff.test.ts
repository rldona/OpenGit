import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  commitFiles,
  diffFile,
  diffNumstat,
  discardSelection,
  stageSelection,
} from "../bridge/diff";
import { statusRepo } from "../bridge/status";
import type { StatusReport } from "../bridge/types";
import { useDiffStore } from "./diff";

vi.mock("../bridge/diff", () => ({
  diffFile: vi.fn(),
  commitFiles: vi.fn(),
  diffNumstat: vi.fn(),
  stageSelection: vi.fn(),
  discardSelection: vi.fn(),
}));

vi.mock("../bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

const REPORT: StatusReport = {
  head: "aaaa",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [
    { kind: "ordinary", xy: ".M", path: "a.txt", orig_path: null },
    { kind: "untracked", xy: "?", path: "nuevo.txt", orig_path: null },
  ],
};

const PATCH = "diff --git a/a.txt b/a.txt\n@@ -1 +1 @@\n-viejo\n+nuevo\n";

describe("useDiffStore", () => {
  beforeEach(() => {
    useDiffStore.getState().reset();
    vi.mocked(statusRepo).mockResolvedValue(REPORT);
    vi.mocked(diffNumstat).mockResolvedValue([
      { path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 1 },
    ]);
    vi.mocked(diffFile).mockResolvedValue(PATCH);
    vi.mocked(commitFiles).mockResolvedValue([
      { path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 0 },
    ]);
  });

  it("construye la lista del working tree y carga el primer parche", async () => {
    await useDiffStore.getState().openWorktree("/tmp/repo");

    const state = useDiffStore.getState();
    expect(state.files.map((file) => file.key)).toEqual(["worktree:a.txt", "worktree:nuevo.txt"]);
    expect(state.selected?.path).toBe("a.txt");
    expect(state.patch).toBe(PATCH);
    expect(state.binary).toBe(false);
    expect(diffFile).toHaveBeenCalledWith({
      path: "/tmp/repo",
      file: "a.txt",
      staged: false,
      rev: null,
      reversed: false,
    });
  });

  it("abre las imágenes en side by side y el texto en unified", async () => {
    vi.mocked(diffNumstat).mockResolvedValue([
      { path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 1 },
      { path: "logo.png", orig_path: null, binary: true, added: null, deleted: null },
    ]);
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [
        { kind: "ordinary", xy: ".M", path: "a.txt", orig_path: null },
        { kind: "ordinary", xy: ".M", path: "logo.png", orig_path: null },
      ],
    });
    await useDiffStore.getState().openWorktree("/tmp/repo");
    expect(useDiffStore.getState().selected?.path).toBe("a.txt");
    expect(useDiffStore.getState().mode).toBe("unified");

    const image = useDiffStore.getState().files.find((file) => file.path === "logo.png")!;
    await useDiffStore.getState().selectFile(image);

    expect(useDiffStore.getState().mode).toBe("side");
  });

  it("respeta el modo elegido a mano para ese fichero", async () => {
    vi.mocked(diffNumstat).mockResolvedValue([
      { path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 1 },
      { path: "logo.png", orig_path: null, binary: true, added: null, deleted: null },
    ]);
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [
        { kind: "ordinary", xy: ".M", path: "a.txt", orig_path: null },
        { kind: "ordinary", xy: ".M", path: "logo.png", orig_path: null },
      ],
    });
    await useDiffStore.getState().openWorktree("/tmp/repo");
    const files = useDiffStore.getState().files;
    const text = files.find((file) => file.path === "a.txt")!;
    const image = files.find((file) => file.path === "logo.png")!;

    await useDiffStore.getState().selectFile(image);
    useDiffStore.getState().setMode("unified");
    await useDiffStore.getState().selectFile(text);
    expect(useDiffStore.getState().mode).toBe("unified");

    await useDiffStore.getState().selectFile(image);
    expect(useDiffStore.getState().mode).toBe("unified");
  });

  it("no pide parche para ficheros sin trackear", async () => {
    await useDiffStore.getState().openWorktree("/tmp/repo");
    const untracked = useDiffStore.getState().files.find((file) => file.untracked);
    vi.mocked(diffFile).mockClear();

    await useDiffStore.getState().selectFile(untracked!);

    expect(diffFile).not.toHaveBeenCalled();
    expect(useDiffStore.getState().patch).toBe("");
  });

  it("invierte el diff volviendo a pedirlo", async () => {
    await useDiffStore.getState().openWorktree("/tmp/repo");
    vi.mocked(diffFile).mockClear();

    await useDiffStore.getState().toggleReverse();

    expect(useDiffStore.getState().reversed).toBe(true);
    expect(diffFile).toHaveBeenCalledWith(expect.objectContaining({ reversed: true }));
  });

  it("aplica stage de un hunk y limpia la selección", async () => {
    await useDiffStore.getState().openWorktree("/tmp/repo");
    useDiffStore.getState().toggleLine(6);
    vi.mocked(stageSelection).mockResolvedValue(undefined);

    await useDiffStore.getState().applySelection({ kind: "hunk", index: 0 });

    expect(stageSelection).toHaveBeenCalledWith({
      path: "/tmp/repo",
      file: "a.txt",
      staged: false,
      selection: { kind: "hunk", index: 0 },
      reverse: false,
    });
    expect(useDiffStore.getState().selectedLines).toEqual([]);
  });

  it("hace unstage usando el diff del index", async () => {
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [{ kind: "ordinary", xy: "M.", path: "a.txt", orig_path: null }],
    });
    await useDiffStore.getState().openWorktree("/tmp/repo");

    await useDiffStore.getState().applySelection({ kind: "file" });

    expect(stageSelection).toHaveBeenCalledWith(
      expect.objectContaining({ staged: true, reverse: true, selection: { kind: "file" } }),
    );
  });

  it("no permite staging en el diff de un commit", async () => {
    await useDiffStore.getState().openCommit("/tmp/repo", "abc1234");

    await useDiffStore.getState().applySelection({ kind: "file" });

    expect(stageSelection).not.toHaveBeenCalled();
  });

  it("descarta hunks del lado unstaged y refresca", async () => {
    vi.mocked(discardSelection).mockResolvedValue(undefined);
    await useDiffStore.getState().openWorktree("/tmp/repo");
    useDiffStore.setState({ selectedLines: [6] });

    await useDiffStore.getState().discardSelection({ kind: "lines", indices: [6] });

    expect(discardSelection).toHaveBeenCalledWith({
      path: "/tmp/repo",
      file: "a.txt",
      selection: { kind: "lines", indices: [6] },
    });
    expect(useDiffStore.getState().selectedLines).toEqual([]);
    expect(statusRepo).toHaveBeenCalled();
  });

  it("no descarta desde el index ni desde un commit", async () => {
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [{ kind: "ordinary", xy: "M.", path: "a.txt", orig_path: null }],
    });
    await useDiffStore.getState().openWorktree("/tmp/repo");

    await useDiffStore.getState().discardSelection({ kind: "file" });
    expect(discardSelection).not.toHaveBeenCalled();

    await useDiffStore.getState().openCommit("/tmp/repo", "abc1234");
    await useDiffStore.getState().discardSelection({ kind: "file" });
    expect(discardSelection).not.toHaveBeenCalled();
  });

  it("abre el diff de un commit", async () => {
    await useDiffStore.getState().openCommit("/tmp/repo", "abc1234");

    expect(commitFiles).toHaveBeenCalledWith("/tmp/repo", "abc1234");
    expect(useDiffStore.getState().files).toHaveLength(1);
    expect(diffFile).toHaveBeenCalledWith(expect.objectContaining({ rev: "abc1234" }));
  });

  it("descarta la respuesta de un commit que ya no es el seleccionado", async () => {
    // El primero tarda más que el segundo: sin guard, su respuesta pisaría la buena.
    let resolveSlow: ((value: never[]) => void) | null = null;
    vi.mocked(commitFiles)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSlow = resolve as (value: never[]) => void;
          }),
      )
      .mockResolvedValueOnce([
        { path: "rapido.txt", orig_path: null, binary: false, added: 2, deleted: 0 },
      ]);

    const slow = useDiffStore.getState().openCommit("/tmp/repo", "lento00");
    await useDiffStore.getState().openCommit("/tmp/repo", "rapido0");

    resolveSlow!([]);
    await slow;

    const state = useDiffStore.getState();
    expect(state.target).toEqual({ kind: "commit", rev: "rapido0" });
    expect(state.files.map((file) => file.path)).toEqual(["rapido.txt"]);
  });
});
