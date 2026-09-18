import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import { stashApply, stashDrop, stashList } from "../lib/bridge/stash";
import { statusRepo } from "../lib/bridge/status";
import type { RepoInfo, Stash, StatusReport } from "../lib/bridge/types";
import { useRepoStore } from "../lib/stores/repo";
import { useStashStore } from "../lib/stores/stash";
import { StashView } from "./StashView";

vi.mock("../lib/bridge/stash", () => ({
  stashList: vi.fn().mockResolvedValue([]),
  stashPush: vi.fn(),
  stashApply: vi.fn(),
  stashDrop: vi.fn(),
  stashShow: vi.fn(),
}));

vi.mock("../lib/bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn().mockResolvedValue(true),
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

const STASH: Stash = {
  reference: "stash@{0}",
  subject: "WIP on main: cambios",
  timestamp: 1_789_725_600,
  hash: "abc",
};

const CLEAN: StatusReport = {
  head: "aaaa",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [],
};

const MULTI_PATCH = [
  "diff --git a/uno.txt b/uno.txt",
  "index 1111111..2222222 100644",
  "--- a/uno.txt",
  "+++ b/uno.txt",
  "@@ -1 +1 @@",
  "-viejo",
  "+nuevo",
  "diff --git a/dos.txt b/dos.txt",
  "index 3333333..4444444 100644",
  "--- a/dos.txt",
  "+++ b/dos.txt",
  "@@ -1 +1 @@",
  "-a",
  "+b",
].join("\n");

describe("StashView", () => {
  beforeEach(() => {
    vi.mocked(stashApply).mockResolvedValue(undefined);
    vi.mocked(stashDrop).mockResolvedValue(undefined);
    vi.mocked(stashList).mockResolvedValue([STASH]);
    vi.mocked(statusRepo).mockResolvedValue(CLEAN);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useStashStore.getState().reset();
    useStashStore.setState({ root: REPO.root, stashes: [STASH] });
  });

  it("sin selección pide elegir un stash", () => {
    render(<StashView />);

    expect(screen.getByText(/Select a stash/)).toBeInTheDocument();
  });

  it("muestra la cabecera con mensaje y rama, y un bloque por fichero", () => {
    useStashStore.setState({ diffReference: STASH.reference, diffPatch: MULTI_PATCH });
    render(<StashView />);

    expect(screen.getByRole("heading", { name: "WIP on main: cambios" })).toBeInTheDocument();
    expect(screen.getByText("from main")).toBeInTheDocument();
    expect(screen.getByText("uno.txt")).toBeInTheDocument();
    expect(screen.getByText("dos.txt")).toBeInTheDocument();
    expect(screen.getAllByText("File contents")).toHaveLength(2);
    expect(screen.getByText("-viejo")).toBeInTheDocument();
    // Un contador por fichero: los dos parches suman una línea.
    expect(screen.getAllByText("+1")).toHaveLength(2);
  });

  it("pliega el parche de un fichero", async () => {
    const user = userEvent.setup();
    useStashStore.setState({ diffReference: STASH.reference, diffPatch: MULTI_PATCH });
    render(<StashView />);

    await user.click(screen.getByRole("button", { name: "Toggle uno.txt" }));

    expect(screen.queryByText("-viejo")).not.toBeInTheDocument();
    expect(screen.getByText("-a")).toBeInTheDocument();
  });

  it("drop pide confirmación antes de borrar", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmDestructive).mockResolvedValue(false);
    useStashStore.setState({ diffReference: STASH.reference, diffPatch: MULTI_PATCH });
    render(<StashView />);

    await user.click(screen.getByRole("button", { name: "Drop" }));
    expect(stashDrop).not.toHaveBeenCalled();

    vi.mocked(confirmDestructive).mockResolvedValue(true);
    await user.click(screen.getByRole("button", { name: "Drop" }));
    expect(stashDrop).toHaveBeenCalledWith("/tmp/repo", "stash@{0}");
  });

  it("apply y pop usan la referencia seleccionada", async () => {
    const user = userEvent.setup();
    useStashStore.setState({ diffReference: STASH.reference, diffPatch: MULTI_PATCH });
    render(<StashView />);

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(stashApply).toHaveBeenCalledWith("/tmp/repo", "stash@{0}", false);

    await user.click(screen.getByRole("button", { name: "Pop" }));
    expect(stashApply).toHaveBeenCalledWith("/tmp/repo", "stash@{0}", true);
  });

  it("un stash sin cambios lo dice sin pintar ficheros", () => {
    useStashStore.setState({ diffReference: STASH.reference, diffPatch: "" });
    render(<StashView />);

    expect(screen.getByText("No changes in this stash")).toBeInTheDocument();
  });
});
