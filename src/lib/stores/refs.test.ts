import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../bridge/dialog";
import { listRefs, logPage } from "../bridge/log";
import { branchTracking, checkoutRef, deleteBranch } from "../bridge/refs";
import { statusRepo } from "../bridge/status";
import type { RefEntry, StatusReport } from "../bridge/types";
import { useRefsStore } from "./refs";
import { useStatusStore } from "./status";

vi.mock("../bridge/refs", () => ({
  branchTracking: vi.fn(),
  checkoutRef: vi.fn(),
  createBranch: vi.fn(),
  renameBranch: vi.fn(),
  deleteBranch: vi.fn(),
}));

vi.mock("../bridge/log", () => ({
  listRefs: vi.fn(),
  logPage: vi.fn(),
}));

vi.mock("../bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

vi.mock("../bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn(),
}));

const REFS: RefEntry[] = [
  { name: "refs/heads/main", object_id: "a", object_type: "commit", upstream: null, track: null },
  {
    name: "refs/heads/feature",
    object_id: "b",
    object_type: "commit",
    upstream: null,
    track: null,
  },
  {
    name: "refs/remotes/origin/remota",
    object_id: "c",
    object_type: "commit",
    upstream: null,
    track: null,
  },
  { name: "refs/tags/v1.0.0", object_id: "d", object_type: "tag", upstream: null, track: null },
];

const CLEAN: StatusReport = {
  head: "a",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [],
};

describe("useRefsStore", () => {
  beforeEach(() => {
    useRefsStore.getState().reset();
    vi.mocked(listRefs).mockResolvedValue(REFS);
    vi.mocked(branchTracking).mockResolvedValue({
      current: "main",
      upstream: null,
      ahead: 0,
      behind: 0,
    });
    vi.mocked(statusRepo).mockResolvedValue(CLEAN);
    vi.mocked(logPage).mockResolvedValue([]);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
  });

  it("carga refs y tracking de la rama actual", async () => {
    vi.mocked(branchTracking).mockResolvedValue({
      current: "main",
      upstream: "origin/main",
      ahead: 1,
      behind: 2,
    });

    await useRefsStore.getState().load("/tmp/repo");

    expect(useRefsStore.getState().refs).toHaveLength(4);
    expect(useRefsStore.getState().current).toBe("main");
    expect(useRefsStore.getState().ahead).toBe(1);
    expect(useRefsStore.getState().behind).toBe(2);
  });

  it("hace checkout de una rama local", async () => {
    await useRefsStore.getState().load("/tmp/repo");
    const feature = REFS[1];

    await useRefsStore.getState().checkout("/tmp/repo", feature);

    expect(checkoutRef).toHaveBeenCalledWith("/tmp/repo", "feature", false);
  });

  it("hace checkout de una remota creando la local con tracking", async () => {
    await useRefsStore.getState().load("/tmp/repo");
    const remote = REFS[2];

    await useRefsStore.getState().checkout("/tmp/repo", remote);

    expect(checkoutRef).toHaveBeenCalledWith("/tmp/repo", "origin/remota", true);
  });

  it("avisa si hay cambios sin commitear y respeta la cancelación", async () => {
    useStatusStore.setState({
      report: {
        ...CLEAN,
        entries: [{ kind: "ordinary", xy: ".M", path: "a.txt", orig_path: null }],
      },
    });
    vi.mocked(confirmDestructive).mockResolvedValue(false);
    await useRefsStore.getState().load("/tmp/repo");

    await useRefsStore.getState().checkout("/tmp/repo", REFS[1]);

    expect(confirmDestructive).toHaveBeenCalled();
    expect(checkoutRef).not.toHaveBeenCalled();
  });

  it("pide borrar con force cuando la rama no está mergeada", async () => {
    vi.mocked(deleteBranch).mockRejectedValue({
      kind: "command_failed",
      exit_code: 1,
      stdout: "error: The branch 'feature' is not fully merged.",
      stderr: "",
      args: ["branch", "-d", "feature"],
    });
    await useRefsStore.getState().load("/tmp/repo");

    await useRefsStore.getState().remove("/tmp/repo", "feature");

    expect(useRefsStore.getState().pendingForceDelete).toBe("feature");
    expect(useRefsStore.getState().error).toContain("not fully merged");
  });

  it("el force delete exige teclear el nombre", async () => {
    await useRefsStore.getState().load("/tmp/repo");

    await useRefsStore.getState().forceRemove("/tmp/repo", "feature", "otra");
    expect(deleteBranch).not.toHaveBeenCalled();

    await useRefsStore.getState().forceRemove("/tmp/repo", "feature", "feature");
    expect(deleteBranch).toHaveBeenCalledWith("/tmp/repo", "feature", true);
  });
});
