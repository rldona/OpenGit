import { beforeEach, describe, expect, it, vi } from "vitest";
import { interactiveRebase, rebasePlan } from "../bridge/rebase";
import { logPage } from "../bridge/log";
import { branchTracking } from "../bridge/refs";
import { statusRepo } from "../bridge/status";
import { repoOpState } from "../bridge/commit";
import type { StatusReport } from "../bridge/types";
import { useRebaseStore } from "./rebase";
import { useUiStore } from "./ui";

vi.mock("../bridge/rebase", () => ({
  rebasePlan: vi.fn(),
  interactiveRebase: vi.fn(),
}));

vi.mock("../bridge/commit", () => ({
  commitMessage: vi.fn().mockResolvedValue(""),
  commitRepo: vi.fn(),
  repoOpState: vi.fn(),
}));

vi.mock("../bridge/log", () => ({
  listRefs: vi.fn().mockResolvedValue([]),
  logPage: vi.fn().mockResolvedValue([]),
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

vi.mock("../bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

const PLAN = [
  { hash: "aaaa1111", short: "aaaa1111", subject: "uno" },
  { hash: "bbbb2222", short: "bbbb2222", subject: "dos" },
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

describe("useRebaseStore", () => {
  beforeEach(() => {
    useRebaseStore.getState().reset();
    useUiStore.setState({ outputLines: [] });
    vi.mocked(rebasePlan).mockResolvedValue(PLAN);
    vi.mocked(interactiveRebase).mockResolvedValue(undefined);
    vi.mocked(statusRepo).mockResolvedValue(CLEAN);
    vi.mocked(branchTracking).mockResolvedValue({
      current: "main",
      upstream: null,
      ahead: 0,
      behind: 0,
    });
    vi.mocked(repoOpState).mockResolvedValue({
      merge: false,
      rebase: false,
      cherry_pick: false,
      revert: false,
      rebase_current: null,
      rebase_total: null,
    });
  });

  it("carga el plan con todo en pick", async () => {
    await useRebaseStore.getState().open("/tmp/repo", "base1234");

    expect(rebasePlan).toHaveBeenCalledWith("/tmp/repo", "base1234");
    expect(useRebaseStore.getState().rows.map((row) => row.action)).toEqual(["pick", "pick"]);
  });

  it("permite un solo reword por plan", async () => {
    await useRebaseStore.getState().open("/tmp/repo", "base1234");

    useRebaseStore.getState().setAction(0, "reword");
    useRebaseStore.getState().setAction(1, "reword");

    expect(useRebaseStore.getState().rows.map((row) => row.action)).toEqual(["pick", "reword"]);
  });

  it("mueve filas arriba y abajo", async () => {
    await useRebaseStore.getState().open("/tmp/repo", "base1234");

    useRebaseStore.getState().move(1, -1);

    expect(useRebaseStore.getState().rows.map((row) => row.subject)).toEqual(["dos", "uno"]);
  });

  it("exige mensaje cuando hay reword", async () => {
    await useRebaseStore.getState().open("/tmp/repo", "base1234");
    useRebaseStore.getState().setAction(0, "reword");

    const ok = await useRebaseStore.getState().run("/tmp/repo");

    expect(ok).toBe(false);
    expect(useRebaseStore.getState().error).toContain("reworded commit");
    expect(interactiveRebase).not.toHaveBeenCalled();
  });

  it("ejecuta el rebase y refresca", async () => {
    await useRebaseStore.getState().open("/tmp/repo", "base1234");
    useRebaseStore.getState().setAction(1, "squash");

    const ok = await useRebaseStore.getState().run("/tmp/repo");

    expect(ok).toBe(true);
    expect(interactiveRebase).toHaveBeenCalledWith(
      "/tmp/repo",
      "base1234",
      [
        { hash: "aaaa1111", action: "pick" },
        { hash: "bbbb2222", action: "squash" },
      ],
      null,
    );
    expect(statusRepo).toHaveBeenCalled();
    expect(logPage).toHaveBeenCalled();
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Interactive rebase");
  });
});
