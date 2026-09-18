import { beforeEach, describe, expect, it, vi } from "vitest";
import { lfsStatus, remoteUrls, submoduleStatus, worktreeList } from "../bridge/repo";
import type { LfsStatus, Remote, Submodule, Worktree } from "../bridge/types";
import { useExtrasStore } from "./extras";

vi.mock("../bridge/repo", () => ({
  submoduleStatus: vi.fn(),
  worktreeList: vi.fn(),
  lfsStatus: vi.fn(),
  remoteUrls: vi.fn(),
}));

const SUBMODULES: Submodule[] = [
  { path: "vendor/lib", head: "a".repeat(40), state: "clean", describe: "heads/main" },
];

const WORKTREES: Worktree[] = [
  {
    path: "/tmp/repo",
    head: "a".repeat(40),
    branch: "refs/heads/main",
    detached: false,
    bare: false,
    locked: false,
  },
];

const LFS: LfsStatus = { installed: false, version: null, configured: true };

const REMOTES: Remote[] = [
  {
    name: "origin",
    url: "git@github.com:rldona/opengit.git",
    web_url: "https://github.com/rldona/opengit",
  },
];

describe("useExtrasStore", () => {
  beforeEach(() => {
    vi.mocked(submoduleStatus).mockResolvedValue(SUBMODULES);
    vi.mocked(worktreeList).mockResolvedValue(WORKTREES);
    vi.mocked(lfsStatus).mockResolvedValue(LFS);
    vi.mocked(remoteUrls).mockResolvedValue(REMOTES);
    useExtrasStore.getState().reset();
  });

  it("load guarda submódulos, worktrees, LFS y remotos", async () => {
    await useExtrasStore.getState().load("/tmp/repo");

    expect(submoduleStatus).toHaveBeenCalledWith("/tmp/repo");
    expect(worktreeList).toHaveBeenCalledWith("/tmp/repo");
    expect(lfsStatus).toHaveBeenCalledWith("/tmp/repo");
    expect(remoteUrls).toHaveBeenCalledWith("/tmp/repo");
    expect(useExtrasStore.getState().submodules).toEqual(SUBMODULES);
    expect(useExtrasStore.getState().worktrees).toEqual(WORKTREES);
    expect(useExtrasStore.getState().lfs).toEqual(LFS);
    expect(useExtrasStore.getState().remotes).toEqual(REMOTES);
    expect(useExtrasStore.getState().loading).toBe(false);
    expect(useExtrasStore.getState().error).toBeNull();
  });

  it("load registra el error y deja de cargar", async () => {
    vi.mocked(submoduleStatus).mockRejectedValue(new Error("boom"));

    await useExtrasStore.getState().load("/tmp/repo");

    expect(useExtrasStore.getState().error).toContain("boom");
    expect(useExtrasStore.getState().loading).toBe(false);
  });

  it("refresh actualiza las listas", async () => {
    useExtrasStore.setState({ root: "/tmp/repo", submodules: [], worktrees: [], lfs: null });

    await useExtrasStore.getState().refresh("/tmp/repo");

    expect(useExtrasStore.getState().submodules).toEqual(SUBMODULES);
    expect(useExtrasStore.getState().worktrees).toEqual(WORKTREES);
    expect(useExtrasStore.getState().lfs).toEqual(LFS);
  });

  it("reset vacía el estado", () => {
    useExtrasStore.setState({
      root: "/tmp/repo",
      submodules: SUBMODULES,
      worktrees: WORKTREES,
      lfs: LFS,
      remotes: REMOTES,
    });

    useExtrasStore.getState().reset();

    expect(useExtrasStore.getState().root).toBeNull();
    expect(useExtrasStore.getState().submodules).toEqual([]);
    expect(useExtrasStore.getState().worktrees).toEqual([]);
    expect(useExtrasStore.getState().lfs).toBeNull();
    expect(useExtrasStore.getState().remotes).toEqual([]);
  });
});
