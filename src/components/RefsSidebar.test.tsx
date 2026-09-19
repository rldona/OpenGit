import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import { startRemoteJob } from "../lib/bridge/jobs";
import { listRefs, logPage } from "../lib/bridge/log";
import { openExternal } from "../lib/bridge/opener";
import { checkoutRef, mergeBranch } from "../lib/bridge/refs";
import { tagCreate, tagDelete } from "../lib/bridge/tags";
import type { RefEntry, Remote, RepoInfo } from "../lib/bridge/types";
import { useExtrasStore } from "../lib/stores/extras";
import { useLogStore } from "../lib/stores/log";
import { useRefsStore } from "../lib/stores/refs";
import { useCollapseStore } from "../lib/stores/collapse";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";
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
  mergeBranch: vi.fn().mockResolvedValue({ conflicted: false, output: "" }),
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
  {
    name: "refs/heads/main",
    object_id: "a",
    object_type: "commit",
    upstream: null,
    track: null,
    target: "a",
  },
  {
    name: "refs/heads/feature",
    object_id: "b",
    object_type: "commit",
    upstream: "refs/remotes/origin/feature",
    track: "[ahead 1, behind 2]",
    target: "b",
  },
  {
    name: "refs/remotes/origin/remota",
    object_id: "c",
    object_type: "commit",
    upstream: null,
    track: null,
    target: "c",
  },
  {
    name: "refs/tags/v1.0.0",
    object_id: "d",
    object_type: "tag",
    upstream: null,
    track: null,
    target: "commit-d",
  },
  {
    name: "refs/tags/ligero",
    object_id: "e",
    object_type: "commit",
    upstream: null,
    track: null,
    target: "e",
  },
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
    localStorage.clear();
    useCollapseStore.setState({ collapsed: {} });
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
    const user = userEvent.setup();
    render(<RefsSidebar />);

    await screen.findByText("feature");
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("feature")).toBeInTheDocument();
    // Los remotos arrancan plegados: hay que abrir "origin" para ver sus ramas.
    await user.click(screen.getByRole("button", { name: "origin" }));
    expect(screen.getByText("origin/remota")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByLabelText("Current branch")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0").querySelector(".refs-tag-mark.annotated")).not.toBeNull();
    expect(screen.getByText("ligero").querySelector(".refs-tag-mark.annotated")).toBeNull();
    expect(screen.getByText("1↑")).toBeInTheDocument();
    expect(screen.getByText("2↓")).toBeInTheDocument();
  });

  it("selecciona la rama al pulsar, sin hacer checkout", async () => {
    const user = userEvent.setup();
    render(<RefsSidebar />);

    const feature = await screen.findByRole("button", { name: "feature" });
    await user.click(feature);

    expect(feature).toHaveClass("selected");
    expect(checkoutRef).not.toHaveBeenCalled();
  });

  it("hace checkout desde el menú contextual", async () => {
    const user = userEvent.setup();
    render(<RefsSidebar />);
    await screen.findByText("feature");

    fireEvent.contextMenu(screen.getByText("feature"));
    await user.click(screen.getByRole("menuitem", { name: "Checkout" }));

    expect(checkoutRef).toHaveBeenCalledWith("/tmp/repo", "feature", false);
  });

  it("selecciona una rama remota sin hacer checkout", async () => {
    const user = userEvent.setup();
    render(<RefsSidebar />);
    await screen.findByText("feature");

    await user.click(screen.getByRole("button", { name: "origin" }));
    const remote = await screen.findByRole("button", { name: "origin/remota" });
    await user.click(remote);

    expect(remote).toHaveClass("selected");
    expect(checkoutRef).not.toHaveBeenCalled();
  });

  it("crea un tag en el commit seleccionado o HEAD", async () => {
    const user = userEvent.setup();
    vi.mocked(tagCreate).mockResolvedValue(undefined);
    render(<RefsSidebar />);
    await screen.findByText("feature");

    fireEvent.contextMenu(screen.getByRole("button", { name: "Tags" }));
    await user.click(screen.getByRole("menuitem", { name: "New Tag…" }));
    await user.type(screen.getByLabelText("New tag name"), "v2.0.0");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(tagCreate).toHaveBeenCalledWith("/tmp/repo", "v2.0.0", "HEAD", null);
  });

  it("localiza en el historial el commit de un tag al pulsarlo", async () => {
    const user = userEvent.setup();
    vi.mocked(logPage).mockResolvedValue([
      {
        hash: "commit-d",
        parents: [],
        author_name: "Ana",
        author_email: "ana@example.com",
        author_time: 1_700_000_000,
        subject: "commit del tag",
        refs: [],
        body: "",
      },
    ]);
    await useLogStore.getState().load("/tmp/repo");
    render(<RefsSidebar />);
    await screen.findByText("feature");

    const tag = screen.getByRole("button", { name: "v1.0.0" });
    await user.click(tag);

    expect(useLogStore.getState().selected).toBe("commit-d");
    expect(useUiStore.getState().activeView).toBe("history");
    expect(tag).toHaveClass("selected");
  });

  it("borra un tag solo tras confirmar", async () => {
    const user = userEvent.setup();
    vi.mocked(tagDelete).mockResolvedValue(undefined);
    render(<RefsSidebar />);
    await screen.findByText("v1.0.0");

    fireEvent.contextMenu(screen.getByText("v1.0.0"));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(tagDelete).toHaveBeenCalledWith("/tmp/repo", "v1.0.0");
  });

  it("hace push del tag al remoto", async () => {
    const user = userEvent.setup();
    render(<RefsSidebar />);
    await screen.findByText("v1.0.0");

    fireEvent.contextMenu(screen.getByText("v1.0.0"));
    await user.click(screen.getByRole("menuitem", { name: "Push" }));

    expect(startRemoteJob).toHaveBeenCalledWith("/tmp/repo", {
      kind: "push_tag",
      remote: null,
      tag: "v1.0.0",
    });
  });

  it("no expone Push ni Delete al pasar por encima de un tag", async () => {
    render(<RefsSidebar />);

    const row = (await screen.findByText("v1.0.0")).closest("li")!;

    expect(within(row).queryByRole("button", { name: "Push" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
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
    await screen.findByText("feature");

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

  it("fusiona una rama en la actual desde el menú contextual", async () => {
    const user = userEvent.setup();
    vi.mocked(mergeBranch).mockResolvedValue({ conflicted: false, output: "" });
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    render(<RefsSidebar />);
    await screen.findByText("feature");

    fireEvent.contextMenu(screen.getByText("feature"));
    await user.click(screen.getByRole("menuitem", { name: "Merge into main" }));

    expect(confirmDestructive).toHaveBeenCalledWith("Merge feature into main?");
    expect(mergeBranch).toHaveBeenCalledWith("/tmp/repo", "feature", false);
  });

  it("no ofrece fusionar la rama actual en sí misma", async () => {
    render(<RefsSidebar />);
    await screen.findByText("feature");

    fireEvent.contextMenu(screen.getByText("main"));

    expect(screen.getByRole("menuitem", { name: "Merge into main" })).toBeDisabled();
  });

  it("abre el menú de la sección Branches con el botón derecho", async () => {
    const user = userEvent.setup();
    render(<RefsSidebar />);
    await screen.findByText("feature");

    fireEvent.contextMenu(screen.getByRole("button", { name: "Branches" }));

    expect(screen.getByRole("menuitem", { name: "New Branch…" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "New Tag…" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "New Remote…" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Add Submodule…" })).toBeDisabled();

    await user.click(screen.getByRole("menuitem", { name: "New Branch…" }));

    expect(screen.getByLabelText("New branch name")).toBeInTheDocument();
  });

  it("no expone Rename ni Delete al pasar por encima de una rama", async () => {
    render(<RefsSidebar />);

    const row = (await screen.findByText("feature")).closest("li")!;

    expect(within(row).queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("pliega los remotos por defecto y los despliega al pulsar", async () => {
    const user = userEvent.setup();
    render(<RefsSidebar />);
    await screen.findByText("feature");

    // Sin esto, un repo con cientos de ramas remotas expulsa de la vista
    // todo lo que va debajo (tags, stashes, submódulos).
    expect(screen.queryByText("origin/remota")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "origin" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(screen.getByText("origin/remota")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("no ofrece abrir remotos sin URL web", async () => {
    useExtrasStore.setState({ remotes: [{ name: "origin", url: "/tmp/origen", web_url: null }] });
    render(<RefsSidebar />);
    await screen.findByText("feature");

    expect(
      screen.queryByRole("button", { name: "Open origin in the browser" }),
    ).not.toBeInTheDocument();
  });
});
