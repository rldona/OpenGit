import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reloadLog: vi.fn().mockResolvedValue(undefined),
  refreshStatus: vi.fn().mockResolvedValue(undefined),
  refreshRefs: vi.fn().mockResolvedValue(undefined),
  refreshExtras: vi.fn().mockResolvedValue(undefined),
  refreshStash: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./stores/log", () => ({
  useLogStore: { getState: () => ({ reload: mocks.reloadLog }) },
}));
vi.mock("./stores/status", () => ({
  useStatusStore: { getState: () => ({ refresh: mocks.refreshStatus }) },
}));
vi.mock("./stores/refs", () => ({
  useRefsStore: { getState: () => ({ refresh: mocks.refreshRefs }) },
}));
vi.mock("./stores/extras", () => ({
  useExtrasStore: { getState: () => ({ refresh: mocks.refreshExtras }) },
}));
vi.mock("./stores/stash", () => ({
  useStashStore: { getState: () => ({ refresh: mocks.refreshStash }) },
}));

import { refreshRepo } from "./refresh";

describe("refreshRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reloads the five stores with the repository root", async () => {
    await refreshRepo("/tmp/repo");

    expect(mocks.reloadLog).toHaveBeenCalledWith("/tmp/repo");
    expect(mocks.refreshStatus).toHaveBeenCalledWith("/tmp/repo");
    expect(mocks.refreshRefs).toHaveBeenCalledWith("/tmp/repo");
    expect(mocks.refreshExtras).toHaveBeenCalledWith("/tmp/repo");
    expect(mocks.refreshStash).toHaveBeenCalledWith("/tmp/repo");
  });

  it("waits for every store before resolving", async () => {
    let done = false;
    mocks.refreshStash.mockImplementationOnce(async () => {
      await Promise.resolve();
      done = true;
    });

    await refreshRepo("/tmp/repo");

    expect(done).toBe(true);
  });
});
