import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openRepoInNewWindow } from "../lib/bridge/app";
import type { RepoInfo } from "../lib/bridge/types";
import { useRepoStore } from "../lib/stores/repo";
import { RepoTabs } from "./RepoTabs";

vi.mock("../lib/bridge/app", () => ({
  openRepoInNewWindow: vi.fn().mockResolvedValue(undefined),
}));

const REPO_A: RepoInfo = {
  root: "/tmp/repo-a",
  name: "repo-a",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "aaaa0000",
  git_version: "2.50.1",
};

const REPO_B: RepoInfo = {
  ...REPO_A,
  root: "/tmp/repo-b",
  name: "repo-b",
};

function tabs() {
  return [
    { path: REPO_A.root, name: REPO_A.name, opened_at: 1 },
    { path: REPO_B.root, name: REPO_B.name, opened_at: 2 },
  ];
}

/** jsdom has no hit testing: the drop target is faked for the pointer drag. */
function stubDropTarget(drop: string | null) {
  const element = document.createElement("div");
  if (drop !== null) {
    element.dataset.drop = drop;
  }
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => element,
  });
}

afterEach(() => {
  // Drop the stub so the fake hit test does not leak into other tests.
  Reflect.deleteProperty(document, "elementFromPoint");
});

function dragTab(name: string) {
  fireEvent.pointerDown(screen.getByRole("tab", { name }), {
    button: 0,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(document, { clientX: 30, clientY: 30 });
  fireEvent.pointerUp(document, { clientX: 30, clientY: 30 });
}

describe("RepoTabs", () => {
  const realActions = (() => {
    const { open, closeTab, moveTab, renameTab, pickAndOpen } = useRepoStore.getState();
    return { open, closeTab, moveTab, renameTab, pickAndOpen };
  })();

  beforeEach(() => {
    vi.clearAllMocks();
    useRepoStore.setState({
      repo: null,
      recents: [],
      openTabs: [],
      loading: false,
      error: null,
      ...realActions,
    });
  });

  it("renders nothing without open repos", () => {
    render(<RepoTabs />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows a single tab with the add button", () => {
    useRepoStore.setState({ repo: REPO_A, openTabs: [tabs()[0]] });
    render(<RepoTabs />);

    expect(screen.getByRole("tab", { name: "repo-a" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Open another repository" })).toBeInTheDocument();
  });

  it("marks the active repo tab as selected with its path as tooltip", () => {
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs() });
    render(<RepoTabs />);

    const tabA = screen.getByRole("tab", { name: "repo-a" });
    const tabB = screen.getByRole("tab", { name: "repo-b" });
    expect(tabA).toHaveAttribute("aria-selected", "true");
    expect(tabB).toHaveAttribute("aria-selected", "false");
    expect(tabA).toHaveAttribute("title", "/tmp/repo-a");
  });

  it("switches repository when a tab is clicked", async () => {
    const user = userEvent.setup();
    const open = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), open });
    render(<RepoTabs />);

    await user.click(screen.getByRole("tab", { name: "repo-b" }));

    expect(open).toHaveBeenCalledWith(REPO_B.root);
  });

  it("closes the tab with the close button", async () => {
    const user = userEvent.setup();
    const closeTab = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), closeTab });
    render(<RepoTabs />);

    await user.click(screen.getByRole("button", { name: "Close repo-b" }));

    expect(closeTab).toHaveBeenCalledWith(REPO_B.root);
  });

  it("opens the picker with the add button", async () => {
    const user = userEvent.setup();
    const pickAndOpen = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ repo: REPO_A, openTabs: [tabs()[0]], pickAndOpen });
    render(<RepoTabs />);

    await user.click(screen.getByRole("button", { name: "Open another repository" }));

    expect(pickAndOpen).toHaveBeenCalledTimes(1);
  });

  it("reorders tabs when one is dropped onto another", () => {
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs() });
    stubDropTarget(`tab:${REPO_B.root}`);
    render(<RepoTabs />);

    dragTab("repo-a");

    expect(useRepoStore.getState().openTabs.map((tab) => tab.path)).toEqual([
      REPO_B.root,
      REPO_A.root,
    ]);
  });

  it("marks the dragged tab and highlights the hovered one while dragging", () => {
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs() });
    stubDropTarget(`tab:${REPO_B.root}`);
    render(<RepoTabs />);

    fireEvent.pointerDown(screen.getByRole("tab", { name: "repo-a" }), {
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(document, { clientX: 30, clientY: 30 });

    expect(screen.getByRole("tab", { name: "repo-a" }).closest(".repo-tab")).toHaveClass(
      "dragging",
    );
    expect(screen.getByRole("tab", { name: "repo-b" }).closest(".repo-tab")).toHaveClass(
      "drop-target",
    );

    fireEvent.pointerUp(document, { clientX: 30, clientY: 30 });
  });

  it("never starts a drag from the close button", () => {
    const moveTab = vi.fn();
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), moveTab });
    stubDropTarget(`tab:${REPO_B.root}`);
    render(<RepoTabs />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Close repo-a" }), {
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(document, { clientX: 30, clientY: 30 });
    fireEvent.pointerUp(document, { clientX: 30, clientY: 30 });

    expect(moveTab).not.toHaveBeenCalled();
  });

  it("ignores a drop onto a non-tab target", () => {
    const moveTab = vi.fn();
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), moveTab });
    stubDropTarget("status-staged");
    render(<RepoTabs />);

    dragTab("repo-a");

    expect(moveTab).not.toHaveBeenCalled();
  });

  it("leaves the order untouched when a tab is dropped onto itself", () => {
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs() });
    stubDropTarget(`tab:${REPO_A.root}`);
    render(<RepoTabs />);

    dragTab("repo-a");

    expect(useRepoStore.getState().openTabs.map((tab) => tab.path)).toEqual([
      REPO_A.root,
      REPO_B.root,
    ]);
  });

  it("leaves the order untouched when dropped outside a tab", () => {
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), moveTab: vi.fn() });
    stubDropTarget(null);
    render(<RepoTabs />);

    dragTab("repo-a");

    expect(useRepoStore.getState().moveTab).not.toHaveBeenCalled();
  });

  it("does not treat the add button as a drop target", () => {
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs() });
    render(<RepoTabs />);

    expect(screen.getByRole("button", { name: "Open another repository" })).not.toHaveAttribute(
      "data-drop",
    );
  });

  it("cancels a tab drag with Escape", () => {
    const moveTab = vi.fn();
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), moveTab });
    stubDropTarget(`tab:${REPO_B.root}`);
    render(<RepoTabs />);

    fireEvent.pointerDown(screen.getByRole("tab", { name: "repo-a" }), {
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(document, { clientX: 30, clientY: 30 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(document, { clientX: 30, clientY: 30 });

    expect(moveTab).not.toHaveBeenCalled();
  });

  it("offers to open a tab in a new window", async () => {
    const user = userEvent.setup();
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs() });
    render(<RepoTabs />);

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("tab", { name: "repo-b" }),
    });
    await user.click(await screen.findByRole("menuitem", { name: "Open in New Window" }));

    expect(openRepoInNewWindow).toHaveBeenCalledWith(REPO_B.root);
  });

  it("offers to rename a tab from the context menu", async () => {
    const user = userEvent.setup();
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs() });
    render(<RepoTabs />);

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("tab", { name: "repo-b" }),
    });
    await user.click(await screen.findByRole("menuitem", { name: "Rename the tab" }));

    expect(screen.getByRole("textbox", { name: "Rename repo-b" })).toBeInTheDocument();
  });

  it("prefills the rename input and selects the text", async () => {
    const user = userEvent.setup();
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs() });
    render(<RepoTabs />);

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("tab", { name: "repo-a" }),
    });
    await user.click(await screen.findByRole("menuitem", { name: "Rename the tab" }));

    const input = screen.getByRole("textbox", { name: "Rename repo-a" }) as HTMLInputElement;
    expect(input).toHaveValue("repo-a");
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("repo-a".length);
  });

  it("commits the rename on Enter", async () => {
    const user = userEvent.setup();
    const renameTab = vi.fn();
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), renameTab });
    render(<RepoTabs />);

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("tab", { name: "repo-a" }),
    });
    await user.click(await screen.findByRole("menuitem", { name: "Rename the tab" }));
    const input = screen.getByRole("textbox", { name: "Rename repo-a" });
    await user.clear(input);
    await user.type(input, "Alpha{Enter}");

    expect(renameTab).toHaveBeenCalledWith(REPO_A.root, "Alpha");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("cancels the rename with Escape without committing", async () => {
    const user = userEvent.setup();
    const renameTab = vi.fn();
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), renameTab });
    render(<RepoTabs />);

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("tab", { name: "repo-a" }),
    });
    await user.click(await screen.findByRole("menuitem", { name: "Rename the tab" }));
    const input = screen.getByRole("textbox", { name: "Rename repo-a" });

    fireEvent.keyDown(input, { key: "Escape" });

    expect(renameTab).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "repo-a" })).toBeInTheDocument();
  });

  it("commits the rename on blur", async () => {
    const user = userEvent.setup();
    const renameTab = vi.fn();
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), renameTab });
    render(<RepoTabs />);

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("tab", { name: "repo-a" }),
    });
    await user.click(await screen.findByRole("menuitem", { name: "Rename the tab" }));
    const input = screen.getByRole("textbox", { name: "Rename repo-a" });
    await user.clear(input);
    await user.type(input, "Renamed");
    fireEvent.blur(input);

    expect(renameTab).toHaveBeenCalledWith(REPO_A.root, "Renamed");
  });

  it("never starts a drag from the rename input", async () => {
    const user = userEvent.setup();
    const moveTab = vi.fn();
    useRepoStore.setState({ repo: REPO_A, openTabs: tabs(), moveTab });
    stubDropTarget(`tab:${REPO_B.root}`);
    render(<RepoTabs />);

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("tab", { name: "repo-a" }),
    });
    await user.click(await screen.findByRole("menuitem", { name: "Rename the tab" }));
    const input = screen.getByRole("textbox", { name: "Rename repo-a" });

    fireEvent.pointerDown(input, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(document, { clientX: 30, clientY: 30 });
    fireEvent.pointerUp(document, { clientX: 30, clientY: 30 });

    expect(moveTab).not.toHaveBeenCalled();
  });

  it("renders a custom title instead of the folder name", () => {
    useRepoStore.setState({
      repo: REPO_A,
      openTabs: [{ ...tabs()[0], title: "Custom" }, tabs()[1]],
    });
    render(<RepoTabs />);

    expect(screen.getByRole("tab", { name: "Custom" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "repo-a" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Custom" })).toBeInTheDocument();
  });

  it("resets to the folder name when the rename is empty", async () => {
    const user = userEvent.setup();
    useRepoStore.setState({
      repo: REPO_A,
      openTabs: [{ ...tabs()[0], title: "Custom" }],
    });
    render(<RepoTabs />);

    expect(screen.getByRole("tab", { name: "Custom" })).toBeInTheDocument();

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("tab", { name: "Custom" }),
    });
    await user.click(await screen.findByRole("menuitem", { name: "Rename the tab" }));
    const input = screen.getByRole("textbox", { name: "Rename Custom" });
    await user.clear(input);
    await user.type(input, "{Enter}");

    expect(screen.getByRole("tab", { name: "repo-a" })).toBeInTheDocument();
  });
});
