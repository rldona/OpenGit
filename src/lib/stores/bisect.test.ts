import { beforeEach, describe, expect, it, vi } from "vitest";
import { bisectMark, bisectReset, bisectStart, bisectState } from "../bridge/bisect";
import { useBisectStore } from "./bisect";
import { useUiStore } from "./ui";

vi.mock("../bridge/bisect", () => ({
  bisectStart: vi.fn().mockResolvedValue(undefined),
  bisectMark: vi.fn().mockResolvedValue(undefined),
  bisectReset: vi.fn().mockResolvedValue(undefined),
  bisectState: vi.fn().mockResolvedValue({ active: false, current: null, remaining: null }),
}));

const ACTIVE = { active: true, current: "abcdef1234", remaining: 3 };

describe("useBisectStore", () => {
  beforeEach(() => {
    useBisectStore.getState().resetState();
    useUiStore.setState({ outputLines: [] });
    vi.mocked(bisectStart).mockResolvedValue(undefined);
    vi.mocked(bisectMark).mockResolvedValue(undefined);
    vi.mocked(bisectReset).mockResolvedValue(undefined);
    vi.mocked(bisectState).mockResolvedValue({ active: false, current: null, remaining: null });
  });

  it("loads the state", async () => {
    vi.mocked(bisectState).mockResolvedValue(ACTIVE);

    await useBisectStore.getState().load("/tmp/repo");

    expect(useBisectStore.getState().state).toEqual(ACTIVE);
  });

  it("starts a bisect and reloads", async () => {
    await useBisectStore.getState().start("/tmp/repo", "HEAD", ["HEAD~10"]);

    expect(bisectStart).toHaveBeenCalledWith("/tmp/repo", "HEAD", ["HEAD~10"]);
    expect(bisectState).toHaveBeenCalled();
  });

  it("marks and resets", async () => {
    await useBisectStore.getState().mark("/tmp/repo", "good");
    await useBisectStore.getState().reset("/tmp/repo");

    expect(bisectMark).toHaveBeenCalledWith("/tmp/repo", "good");
    expect(bisectReset).toHaveBeenCalledWith("/tmp/repo");
  });
});
