import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRefs } from "../lib/bridge/log";
import { checkoutRef } from "../lib/bridge/refs";
import type { RefEntry, RepoInfo } from "../lib/bridge/types";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { RefsSidebar } from "./RefsSidebar";

vi.mock("../lib/bridge/refs", () => ({
  branchTracking: vi
    .fn()
    .mockResolvedValue({ current: "main", upstream: null, ahead: 0, behind: 0 }),
  checkoutRef: vi.fn(),
  createBranch: vi.fn(),
  renameBranch: vi.fn(),
  deleteBranch: vi.fn(),
}));

vi.mock("../lib/bridge/log", () => ({
  listRefs: vi.fn(),
  logPage: vi.fn(),
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
  { name: "refs/tags/ligero", object_id: "e", object_type: "commit", upstream: null, track: null },
];

describe("RefsSidebar", () => {
  beforeEach(() => {
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useRefsStore.getState().reset();
    useRefsStore.setState({
      root: REPO.root,
      refs: REFS,
      current: "main",
      upstream: null,
      ahead: 0,
      behind: 0,
    });
    vi.mocked(checkoutRef).mockResolvedValue(undefined);
    vi.mocked(listRefs).mockResolvedValue(REFS);
  });

  it("muestra ramas, remotas y tags con la actual marcada", async () => {
    render(<RefsSidebar />);

    await screen.findByText("feature");
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("feature")).toBeInTheDocument();
    expect(screen.getByText("origin/remota")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByLabelText("Current branch")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0").querySelector(".refs-tag-mark.annotated")).not.toBeNull();
    expect(screen.getByText("ligero").querySelector(".refs-tag-mark.annotated")).toBeNull();
  });

  it("filtra el árbol de refs", async () => {
    const user = userEvent.setup();
    render(<RefsSidebar />);
    await screen.findByText("feature");

    await user.type(screen.getByLabelText("Filter refs"), "feat");

    expect(screen.queryByText("main")).not.toBeInTheDocument();
    expect(screen.getByText("feature")).toBeInTheDocument();
    expect(screen.queryByText("v1.0.0")).not.toBeInTheDocument();
  });

  it("hace checkout al pulsar una rama local", async () => {
    const user = userEvent.setup();
    render(<RefsSidebar />);

    await user.click(await screen.findByRole("button", { name: "feature" }));

    expect(checkoutRef).toHaveBeenCalledWith("/tmp/repo", "feature", false);
  });

  it("muestra la confirmación por nombre para borrar sin mergear", () => {
    useRefsStore.setState({ pendingForceDelete: "feature" });
    render(<RefsSidebar />);

    expect(screen.getByText(/Type feature to force delete/)).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm force delete feature")).toBeInTheDocument();
  });
});
