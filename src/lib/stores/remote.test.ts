import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelRemoteJob, startRemoteJob } from "../bridge/jobs";
import { listRefs, logPage } from "../bridge/log";
import { branchTracking } from "../bridge/refs";
import { statusRepo } from "../bridge/status";
import type { JobKind, StatusReport } from "../bridge/types";
import { useLogStore } from "./log";
import { useRefsStore } from "./refs";
import { useRemoteStore } from "./remote";
import { useRepoStore } from "./repo";
import { useUiStore } from "./ui";

vi.mock("../bridge/jobs", () => ({
  startRemoteJob: vi.fn(),
  cancelRemoteJob: vi.fn(),
}));

vi.mock("../bridge/log", () => ({
  listRefs: vi.fn(),
  logPage: vi.fn(),
}));

vi.mock("../bridge/refs", () => ({
  branchTracking: vi.fn(),
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

const PULL: JobKind = {
  kind: "pull",
  remote: null,
  branch: null,
  rebase: false,
  no_ff: false,
  no_commit: false,
  include_messages: false,
};

const CLEAN: StatusReport = {
  head: "a",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [],
};

describe("useRemoteStore", () => {
  beforeEach(() => {
    useRemoteStore.getState().reset();
    useUiStore.setState({ outputLines: [] });
    useLogStore.setState({ root: "/tmp/repo" });
    useRefsStore.setState({ root: "/tmp/repo" });
    vi.mocked(startRemoteJob).mockResolvedValue("job-1");
    vi.mocked(cancelRemoteJob).mockResolvedValue(true);
    vi.mocked(listRefs).mockResolvedValue([]);
    vi.mocked(logPage).mockResolvedValue([]);
    vi.mocked(branchTracking).mockResolvedValue({
      current: "main",
      upstream: null,
      ahead: 0,
      behind: 0,
    });
    vi.mocked(statusRepo).mockResolvedValue(CLEAN);
  });

  it("starts a push and stays running", async () => {
    await useRemoteStore.getState().start("/tmp/repo", {
      kind: "push",
      remote: null,
      set_upstream: true,
    });

    expect(startRemoteJob).toHaveBeenCalledWith("/tmp/repo", {
      kind: "push",
      remote: null,
      set_upstream: true,
    });
    expect(useRemoteStore.getState().running).toBe(true);
    expect(useRemoteStore.getState().jobId).toBe("job-1");
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Running push");
  });

  it("on successful completion refreshes graph, refs and status", async () => {
    await useRemoteStore
      .getState()
      .start("/tmp/repo", { kind: "fetch", prune: false, remote: null });
    useRemoteStore
      .getState()
      .handleOutput({ job_id: "job-1", stream: "stderr", line: "Receiving objects" });
    useRemoteStore.getState().handleFinished({
      job_id: "job-1",
      success: true,
      exit_code: 0,
      cancelled: false,
    });

    expect(useRemoteStore.getState().running).toBe(false);
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Receiving objects");
    expect(useUiStore.getState().outputLines.join("\n")).toContain("fetch done");
    expect(listRefs).toHaveBeenCalled();
    expect(logPage).toHaveBeenCalled();
    expect(statusRepo).toHaveBeenCalled();
  });

  it("translates the non-fast-forward rejection into a hint", async () => {
    await useRemoteStore.getState().start("/tmp/repo", {
      kind: "push",
      remote: null,
      set_upstream: false,
    });
    useRemoteStore.getState().handleOutput({
      job_id: "job-1",
      stream: "stderr",
      line: "! [rejected] main -> main (non-fast-forward)",
    });
    useRemoteStore.getState().handleFinished({
      job_id: "job-1",
      success: false,
      exit_code: 1,
      cancelled: false,
    });

    expect(useRemoteStore.getState().error).toContain("Pull first");
    expect(useUiStore.getState().outputLines.join("\n")).toContain("push failed");
  });

  it("cancels the current job", async () => {
    await useRemoteStore.getState().start("/tmp/repo", PULL);

    await useRemoteStore.getState().cancel();

    expect(cancelRemoteJob).toHaveBeenCalledWith("job-1");
  });

  it("titles the job and keeps the title on error", async () => {
    await useRemoteStore.getState().start("/tmp/repo", {
      kind: "pull",
      remote: "origin",
      branch: "main",
      rebase: false,
      no_ff: false,
      no_commit: false,
      include_messages: false,
    });
    expect(useRemoteStore.getState().title).toBe('Pulling Branch "main" From "origin"');

    useRemoteStore.getState().handleFinished({
      job_id: "job-1",
      success: false,
      exit_code: 1,
      cancelled: false,
    });

    expect(useRemoteStore.getState().error).toBeTruthy();
    expect(useRemoteStore.getState().title).toBe('Pulling Branch "main" From "origin"');

    useRemoteStore.getState().dismiss();

    expect(useRemoteStore.getState().error).toBeNull();
    expect(useRemoteStore.getState().recentLines).toEqual([]);
    expect(useRemoteStore.getState().title).toBeNull();
  });

  it("does not stay running if the end arrives before the id is known", async () => {
    vi.mocked(startRemoteJob).mockImplementation(async () => {
      useRemoteStore.getState().handleFinished({
        job_id: "job-1",
        success: true,
        exit_code: 0,
        cancelled: false,
      });
      return "job-1";
    });

    await useRemoteStore.getState().start("/tmp/repo", PULL);

    expect(useRemoteStore.getState().running).toBe(false);
    expect(useRemoteStore.getState().jobId).toBeNull();
  });

  it("cancels even if the job id has not arrived yet", async () => {
    let release: (id: string) => void = () => {};
    vi.mocked(startRemoteJob).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    const started = useRemoteStore.getState().start("/tmp/repo", PULL);
    await useRemoteStore.getState().cancel();
    release("job-1");
    await started;

    expect(cancelRemoteJob).toHaveBeenCalledWith("job-1");
  });

  it("ignores events from another job", async () => {
    await useRemoteStore.getState().start("/tmp/repo", PULL);

    useRemoteStore.getState().handleFinished({
      job_id: "job-99",
      success: true,
      exit_code: 0,
      cancelled: false,
    });

    expect(useRemoteStore.getState().running).toBe(true);
  });

  it("opens the cloned repository when a clone finishes", async () => {
    const open = vi.spyOn(useRepoStore.getState(), "open").mockResolvedValue(undefined);
    await useRemoteStore.getState().start("/tmp/clones", {
      kind: "clone",
      url: "https://example.com/repo.git",
      destination: "/tmp/clones/repo",
      depth: null,
      branch: null,
      recurse_submodules: false,
    });

    useRemoteStore.getState().handleFinished({
      job_id: "job-1",
      success: true,
      exit_code: 0,
      cancelled: false,
    });

    expect(open).toHaveBeenCalledWith("/tmp/clones/repo");
    open.mockRestore();
  });
});
