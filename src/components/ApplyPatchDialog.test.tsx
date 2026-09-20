import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickFile } from "../lib/bridge/dialog";
import { applyPatch } from "../lib/bridge/patch";
import type { RepoInfo } from "../lib/bridge/types";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";
import { ApplyPatchDialog } from "./ApplyPatchDialog";

vi.mock("../lib/bridge/dialog", () => ({
  pickFile: vi.fn(),
}));

vi.mock("../lib/bridge/patch", () => ({
  applyPatch: vi.fn(),
}));

const REPO: RepoInfo = {
  root: "/tmp/repo",
  name: "repo",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "aaaa0000",
  git_version: "2.50.1",
};

describe("ApplyPatchDialog", () => {
  beforeEach(() => {
    useRepoStore.setState({ repo: REPO });
    useUiStore.setState({ outputLines: [] });
    vi.mocked(pickFile).mockResolvedValue("/tmp/change.patch");
    vi.mocked(applyPatch).mockResolvedValue("Applying: add b");
  });

  it("applies a mailbox patch and reports it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ApplyPatchDialog onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Choose…" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(applyPatch).toHaveBeenCalledWith("/tmp/repo", "/tmp/change.patch", true, false);
    expect(onClose).toHaveBeenCalled();
    expect(useUiStore.getState().outputLines.join("\n")).toContain("Applying: add b");
  });

  it("reports a failure without closing", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(applyPatch).mockRejectedValue(new Error("patch does not apply"));
    render(<ApplyPatchDialog onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Choose…" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("does not apply");
    expect(onClose).not.toHaveBeenCalled();
  });
});
