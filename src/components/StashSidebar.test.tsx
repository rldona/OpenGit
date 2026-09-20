import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import { stashApply, stashDrop, stashList, stashPush } from "../lib/bridge/stash";
import type { RepoInfo, Stash } from "../lib/bridge/types";
import { useRepoStore } from "../lib/stores/repo";
import { useStashStore } from "../lib/stores/stash";
import { StashSidebar } from "./StashSidebar";

vi.mock("../lib/bridge/stash", () => ({
  stashList: vi.fn(),
  stashPush: vi.fn(),
  stashApply: vi.fn(),
  stashDrop: vi.fn(),
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
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useStashStore.getState().reset();
    useStashStore.setState({ root: REPO.root, stashes: STASHES });
  });

  it("lista los stashes con su mensaje", async () => {
    render(<StashSidebar />);

    expect(await screen.findByText("WIP on main: cambios")).toBeInTheDocument();
  });

  it("crea un stash con mensaje e untracked", async () => {
    const user = userEvent.setup();
    render(<StashSidebar />);

    await user.click(screen.getByRole("button", { name: "New stash" }));
    await user.type(screen.getByLabelText("Stash message"), "trabajo a medias");
    await user.click(screen.getByLabelText("Include untracked"));
    await user.click(screen.getByRole("button", { name: "Stash" }));

    expect(stashPush).toHaveBeenCalledWith("/tmp/repo", "trabajo a medias", true);
  });

  it("pop aplica y borra", async () => {
    const user = userEvent.setup();
    render(<StashSidebar />);

    const row = (await screen.findByText("WIP on main: cambios")).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Pop" }));

    expect(stashApply).toHaveBeenCalledWith("/tmp/repo", "stash@{0}", true);
  });

  it("solo borra si se confirma", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmDestructive).mockResolvedValue(false);
    render(<StashSidebar />);

    const row = (await screen.findByText("WIP on main: cambios")).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Drop" }));
    expect(stashDrop).not.toHaveBeenCalled();

    vi.mocked(confirmDestructive).mockResolvedValue(true);
    await user.click(within(row).getByRole("button", { name: "Drop" }));
    expect(stashDrop).toHaveBeenCalledWith("/tmp/repo", "stash@{0}");
  });
});
