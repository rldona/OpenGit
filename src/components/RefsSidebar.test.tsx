import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startRemoteJob } from "../lib/bridge/jobs";
import { listRefs } from "../lib/bridge/log";
import { openExternal } from "../lib/bridge/opener";
import { checkoutRef } from "../lib/bridge/refs";
import { tagCreate, tagDelete } from "../lib/bridge/tags";
import type { RefEntry, Remote, RepoInfo } from "../lib/bridge/types";
import { useExtrasStore } from "../lib/stores/extras";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { RefsSidebar } from "./RefsSidebar";

vi.mock("../lib/bridge/opener", () => ({
  openExternal: vi.fn().mockResolvedValue(undefined),
}));

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

vi.mock("../lib/bridge/tags", () => ({
  tagCreate: vi.fn(),
  tagDelete: vi.fn(),
}));

vi.mock("../lib/bridge/jobs", () => ({
  startRemoteJob: vi.fn().mockResolvedValue("job-1"),
  cancelRemoteJob: vi.fn().mockResolvedValue(true),
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

const REMOTES: Remote[] = [
  {
    name: "origin",
    url: "git@github.com:rldona/opengit.git",
    web_url: "https://github.com/rldona/opengit",
  },
  { name: "local", url: "/tmp/otro", web_url: null },
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
    useExtrasStore.setState({ remotes: REMOTES });
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

  it("crea un tag en el commit seleccionado o HEAD", async () => {
    const user = userEvent.setup();
    vi.mocked(tagCreate).mockResolvedValue(undefined);
    render(<RefsSidebar />);
    await screen.findByText("feature");

    await user.click(screen.getByRole("button", { name: "New tag" }));
    await user.type(screen.getByLabelText("New tag name"), "v2.0.0");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(tagCreate).toHaveBeenCalledWith("/tmp/repo", "v2.0.0", "HEAD", null);
  });

  it("borra un tag solo tras confirmar", async () => {
    const user = userEvent.setup();
    vi.mocked(tagDelete).mockResolvedValue(undefined);
    render(<RefsSidebar />);
    await screen.findByText("v1.0.0");

    const row = screen.getByText("v1.0.0").closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Delete" }));

    expect(tagDelete).toHaveBeenCalledWith("/tmp/repo", "v1.0.0");
  });

  it("hace push del tag al remoto", async () => {
    const user = userEvent.setup();
    render(<RefsSidebar />);
    await screen.findByText("v1.0.0");

    const row = screen.getByText("v1.0.0").closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Push" }));

    expect(startRemoteJob).toHaveBeenCalledWith("/tmp/repo", {
      kind: "push_tag",
      remote: null,
      tag: "v1.0.0",
    });
  });

  it("muestra la confirmación por nombre para borrar sin mergear", () => {
    useRefsStore.setState({ pendingForceDelete: "feature" });
    render(<RefsSidebar />);

    expect(screen.getByText(/Type feature to force delete/)).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm force delete feature")).toBeInTheDocument();
  });

  it("abre la URL web del remoto en el navegador", async () => {
    const user = userEvent.setup();
    render(<RefsSidebar />);
    await screen.findByText("origin/remota");

    await user.click(screen.getByRole("button", { name: "Open origin in the browser" }));

    expect(openExternal).toHaveBeenCalledWith("https://github.com/rldona/opengit");
  });

  it("abre el menú contextual de una rama", async () => {
    render(<RefsSidebar />);
    await screen.findByText("feature");

    fireEvent.contextMenu(screen.getByText("feature"));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Checkout" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Copy name" })).toBeInTheDocument();
  });

  it("no ofrece abrir remotos sin URL web", async () => {
    useExtrasStore.setState({ remotes: [{ name: "origin", url: "/tmp/origen", web_url: null }] });
    render(<RefsSidebar />);
    await screen.findByText("origin/remota");

    expect(
      screen.queryByRole("button", { name: "Open origin in the browser" }),
    ).not.toBeInTheDocument();
  });
});
