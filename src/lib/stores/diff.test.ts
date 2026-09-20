import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  commitFiles,
  compareFile,
  compareNumstat,
  diffFile,
  diffNumstat,
  discardSelection,
  stageSelection,
  untrackedFileDiff,
} from "../bridge/diff";
import { statusRepo } from "../bridge/status";
import type { StatusReport } from "../bridge/types";
import { useDiffStore } from "./diff";

vi.mock("../bridge/diff", () => ({
  diffFile: vi.fn(),
  untrackedFileDiff: vi.fn(),
  commitFiles: vi.fn(),
  compareNumstat: vi.fn(),
  compareFile: vi.fn(),
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

const UNTRACKED_PATCH =
  "diff --git a/nuevo.txt b/nuevo.txt\nnew file mode 100644\nindex 0000000..70e300c\n--- /dev/null\n+++ b/nuevo.txt\n@@ -0,0 +1,2 @@\n+hola\n+mundo\n";

describe("useDiffStore", () => {
  beforeEach(() => {
    useDiffStore.getState().reset();
    vi.mocked(statusRepo).mockResolvedValue(REPORT);
    vi.mocked(diffNumstat).mockResolvedValue([
      { path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 1 },
    ]);
    vi.mocked(diffFile).mockResolvedValue(PATCH);
    vi.mocked(untrackedFileDiff).mockResolvedValue(UNTRACKED_PATCH);
    vi.mocked(commitFiles).mockResolvedValue([
      { path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 0 },
    ]);
    vi.mocked(compareNumstat).mockResolvedValue([
      { path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 1 },
    ]);
    vi.mocked(compareFile).mockResolvedValue(PATCH);
  });

  it("builds the working tree list and loads the first patch", async () => {
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
      options: { ignore_all_space: false, ignore_blank_lines: false, word_diff: false },
    });
  });

  it("opens images side by side and text in unified", async () => {
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

  it("respects the mode chosen by hand for that file", async () => {
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

  it("requests a read-only preview for untracked files", async () => {
    vi.mocked(untrackedFileDiff).mockResolvedValue(UNTRACKED_PATCH);
    await useDiffStore.getState().openWorktree("/tmp/repo");
    const untracked = useDiffStore.getState().files.find((file) => file.untracked);
    vi.mocked(diffFile).mockClear();

    await useDiffStore.getState().selectFile(untracked!);

    expect(diffFile).not.toHaveBeenCalled();
    expect(untrackedFileDiff).toHaveBeenCalledWith("/tmp/repo", "nuevo.txt");
    expect(useDiffStore.getState().patch).toBe(UNTRACKED_PATCH);
    expect(useDiffStore.getState().binary).toBe(false);
    expect(useDiffStore.getState().error).toBeNull();
  });

  it("flags a binary untracked preview without staging actions", async () => {
    vi.mocked(untrackedFileDiff).mockResolvedValue(
      "diff --git a/logo.png b/logo.png\nnew file mode 100644\nindex 0000000..8352675\nBinary files /dev/null and b/logo.png differ\n",
    );
    await useDiffStore.getState().openWorktree("/tmp/repo");
    const untracked = useDiffStore.getState().files.find((file) => file.untracked)!;

    await useDiffStore.getState().selectFile(untracked);
    expect(useDiffStore.getState().binary).toBe(true);

    await useDiffStore.getState().applySelection({ kind: "file" });
    expect(stageSelection).not.toHaveBeenCalled();
  });

  it("reverses the diff by requesting it again", async () => {
    await useDiffStore.getState().openWorktree("/tmp/repo");
    vi.mocked(diffFile).mockClear();

    await useDiffStore.getState().toggleReverse();

    expect(useDiffStore.getState().reversed).toBe(true);
    expect(diffFile).toHaveBeenCalledWith(expect.objectContaining({ reversed: true }));
  });

  it("refreshes the worktree list without moving the selection", async () => {
    await useDiffStore.getState().openWorktree("/tmp/repo");
    expect(useDiffStore.getState().selected?.path).toBe("a.txt");
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [...REPORT.entries, { kind: "ordinary", xy: ".M", path: "b.txt", orig_path: null }],
    });
    vi.mocked(diffFile).mockClear();

    await useDiffStore.getState().refreshWorktree("/tmp/repo");

    const state = useDiffStore.getState();
    expect(state.files.map((file) => file.path)).toEqual(["a.txt", "b.txt", "nuevo.txt"]);
    expect(state.selected?.path).toBe("a.txt");
    expect(state.loading).toBe(false);
    expect(diffFile).toHaveBeenCalledWith(expect.objectContaining({ file: "a.txt" }));
  });

  it("falls back to the first file when the selection is gone", async () => {
    await useDiffStore.getState().openWorktree("/tmp/repo");
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [{ kind: "untracked", xy: "?", path: "nuevo.txt", orig_path: null }],
    });

    await useDiffStore.getState().refreshWorktree("/tmp/repo");

    expect(useDiffStore.getState().selected?.path).toBe("nuevo.txt");
    expect(untrackedFileDiff).toHaveBeenCalledWith("/tmp/repo", "nuevo.txt");
  });

  it("ignores refreshes outside the worktree target", async () => {
    await useDiffStore.getState().openCommit("/tmp/repo", "abc1234");
    vi.mocked(statusRepo).mockClear();
    vi.mocked(diffNumstat).mockClear();

    await useDiffStore.getState().refreshWorktree("/tmp/repo");
    await useDiffStore.getState().refreshWorktree("/tmp/other");

    expect(statusRepo).not.toHaveBeenCalled();
    expect(diffNumstat).not.toHaveBeenCalled();
    expect(useDiffStore.getState().files).toHaveLength(1);
  });

  it("stages a hunk and clears the selection", async () => {
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

  it("unstages using the index diff", async () => {
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

  it("does not allow staging in a commit diff", async () => {
    await useDiffStore.getState().openCommit("/tmp/repo", "abc1234");

    await useDiffStore.getState().applySelection({ kind: "file" });

    expect(stageSelection).not.toHaveBeenCalled();
  });

  it("discards hunks from the unstaged side and refreshes", async () => {
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

  it("does not discard from the index nor from a commit", async () => {
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

  it("opens a commit diff", async () => {
    await useDiffStore.getState().openCommit("/tmp/repo", "abc1234");

    expect(commitFiles).toHaveBeenCalledWith("/tmp/repo", "abc1234");
    expect(useDiffStore.getState().files).toHaveLength(1);
    expect(diffFile).toHaveBeenCalledWith(expect.objectContaining({ rev: "abc1234" }));
  });

  it("discards the response of a commit that is no longer selected", async () => {
    // The first one takes longer than the second: without a guard, its response would overwrite the good one.
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

  it("reset discards an open that is still in flight", async () => {
    let resolveSlow: ((value: never[]) => void) | null = null;
    vi.mocked(commitFiles).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSlow = resolve as (value: never[]) => void;
        }),
    );

    const slow = useDiffStore.getState().openCommit("/tmp/repo", "lento00");
    useDiffStore.getState().reset();
    resolveSlow!([]);
    await slow;

    expect(useDiffStore.getState().target).toBeNull();
    expect(useDiffStore.getState().files).toHaveLength(0);
  });

  it("opens a comparison between two revisions and lists its files", async () => {
    await useDiffStore.getState().openCompare("/tmp/repo", "main", "feature");

    expect(compareNumstat).toHaveBeenCalledWith("/tmp/repo", "main", "feature");
    expect(useDiffStore.getState().target).toEqual({
      kind: "compare",
      base: "main",
      rev: "feature",
    });
    expect(useDiffStore.getState().files).toHaveLength(1);
    expect(compareFile).toHaveBeenCalledWith({
      path: "/tmp/repo",
      base: "main",
      rev: "feature",
      file: "a.txt",
      reversed: false,
      options: { ignore_all_space: false, ignore_blank_lines: false, word_diff: false },
    });
  });

  it("reloads the patch with the chosen diff option", async () => {
    await useDiffStore.getState().openWorktree("/tmp/repo");
    vi.mocked(diffFile).mockClear();

    await useDiffStore.getState().toggleOption("word_diff");

    expect(useDiffStore.getState().options.word_diff).toBe(true);
    expect(diffFile).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { ignore_all_space: false, ignore_blank_lines: false, word_diff: true },
      }),
    );
  });
});
