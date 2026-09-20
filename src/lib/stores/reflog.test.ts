import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTo } from "../bridge/history";
import { reflog as reflogRequest } from "../bridge/reflog";
import { checkoutRef, createBranch } from "../bridge/refs";
import { useReflogStore } from "./reflog";
import { useUiStore } from "./ui";

vi.mock("../bridge/reflog", () => ({ reflog: vi.fn() }));
vi.mock("../bridge/refs", () => ({ checkoutRef: vi.fn(), createBranch: vi.fn() }));
vi.mock("../bridge/history", () => ({ resetTo: vi.fn() }));

const ENTRY = {
  hash: "abcdef1234",
  selector: "HEAD@{0}",
  subject: "commit: x",
  author: "Ana",
  time: 1,
};

describe("useReflogStore", () => {
  beforeEach(() => {
    useReflogStore.getState().resetState();
    useUiStore.setState({ outputLines: [] });
    vi.mocked(reflogRequest).mockResolvedValue([ENTRY]);
    vi.mocked(createBranch).mockResolvedValue(undefined);
    vi.mocked(checkoutRef).mockResolvedValue(undefined);
    vi.mocked(resetTo).mockResolvedValue(undefined);
  });

  it("loads the reflog", async () => {
    await useReflogStore.getState().load("/tmp/repo");

    expect(reflogRequest).toHaveBeenCalledWith("/tmp/repo", 200);
    expect(useReflogStore.getState().entries).toHaveLength(1);
  });

  it("creates a branch at an entry and reloads", async () => {
    await useReflogStore.getState().createBranchAt("/tmp/repo", ENTRY.hash, "recovered");

    expect(createBranch).toHaveBeenCalledWith("/tmp/repo", "recovered", ENTRY.hash);
    expect(reflogRequest).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().outputLines.join("\n")).toContain("recovered");
  });

  it("resets to an entry with the chosen mode", async () => {
    await useReflogStore.getState().reset("/tmp/repo", ENTRY.hash, "hard");

    expect(resetTo).toHaveBeenCalledWith("/tmp/repo", ENTRY.hash, "hard");
  });
});
