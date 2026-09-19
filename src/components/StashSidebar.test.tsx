import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import { stashApply, stashDrop, stashList, stashPush, stashShow } from "../lib/bridge/stash";
import type { RepoInfo, Stash } from "../lib/bridge/types";
import { useRepoStore } from "../lib/stores/repo";
import { useStashStore } from "../lib/stores/stash";
import { useUiStore } from "../lib/stores/ui";
import { StashSidebar } from "./StashSidebar";

vi.mock("../lib/bridge/stash", () => ({
  stashList: vi.fn(),
  stashPush: vi.fn(),
  stashApply: vi.fn(),
  stashDrop: vi.fn(),
  stashShow: vi.fn(),
}));

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn().mockResolvedValue(true),
}));

vi.mock("../lib/bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

const REPO: RepoInfo = {
  root: "/tmp/repo",
  name: "repo",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "aaaa",
  git_version: "2.50.1",
};

const STASHES: Stash[] = [
  {
    reference: "stash@{0}",
    subject: "WIP on main: cambios",
    timestamp: 1_789_725_600,
    hash: "abc",
  },
];

describe("StashSidebar", () => {
  beforeEach(() => {
    vi.mocked(stashList).mockResolvedValue(STASHES);
    vi.mocked(stashPush).mockResolvedValue(undefined);
    vi.mocked(stashApply).mockResolvedValue(undefined);
    vi.mocked(stashDrop).mockResolvedValue(undefined);
    vi.mocked(stashShow).mockResolvedValue("diff --git a/a.txt b/a.txt\n+dos\n");
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useStashStore.getState().reset();
    useStashStore.setState({ root: REPO.root, stashes: STASHES });
  });

  it("lists the stashes with their message", async () => {
    render(<StashSidebar />);

    expect(await screen.findByText("WIP on main: cambios")).toBeInTheDocument();
  });

  it("creates a stash with a message and untracked files", async () => {
    const user = userEvent.setup();
    render(<StashSidebar />);

    fireEvent.contextMenu(screen.getByRole("button", { name: "Stashes" }));
    await user.click(screen.getByRole("menuitem", { name: "Stash Changes…" }));
    await user.type(screen.getByLabelText("Stash message"), "trabajo a medias");
    await user.click(screen.getByLabelText("Include untracked"));
    await user.click(screen.getByRole("button", { name: "Stash" }));

    expect(stashPush).toHaveBeenCalledWith("/tmp/repo", "trabajo a medias", true);
  });

  it("selects the stash and opens the view when clicked", async () => {
    const user = userEvent.setup();
    render(<StashSidebar />);

    const row = await screen.findByRole("button", { name: /WIP on main/ });
    await user.click(row);

    expect(useUiStore.getState().activeView).toBe("stash");
    expect(useStashStore.getState().diffReference).toBe("stash@{0}");
    expect(stashShow).toHaveBeenCalledWith("/tmp/repo", "stash@{0}");
    expect(row).toHaveClass("selected");
  });

  it("pop from the context menu applies and deletes", async () => {
    const user = userEvent.setup();
    render(<StashSidebar />);
    await screen.findByText("WIP on main: cambios");

    fireEvent.contextMenu(screen.getByText("WIP on main: cambios"));
    await user.click(screen.getByRole("menuitem", { name: "Pop" }));

    expect(stashApply).toHaveBeenCalledWith("/tmp/repo", "stash@{0}", true);
  });

  it("only deletes if confirmed", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmDestructive).mockResolvedValue(false);
    render(<StashSidebar />);
    await screen.findByText("WIP on main: cambios");

    fireEvent.contextMenu(screen.getByText("WIP on main: cambios"));
    await user.click(screen.getByRole("menuitem", { name: "Drop" }));
    expect(stashDrop).not.toHaveBeenCalled();

    vi.mocked(confirmDestructive).mockResolvedValue(true);
    fireEvent.contextMenu(screen.getByText("WIP on main: cambios"));
    await user.click(screen.getByRole("menuitem", { name: "Drop" }));
    expect(stashDrop).toHaveBeenCalledWith("/tmp/repo", "stash@{0}");
  });
});
