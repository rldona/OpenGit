import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openExternal, openTerminal, revealInFileManager } from "../lib/bridge/opener";
import type { RepoInfo } from "../lib/bridge/types";
import { useExtrasStore } from "../lib/stores/extras";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
import { useUiStore } from "../lib/stores/ui";
import { Toolbar } from "./Toolbar";

vi.mock("../lib/bridge/opener", () => ({
  openExternal: vi.fn(),
  openTerminal: vi.fn(),
  revealInFileManager: vi.fn(),
}));

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn().mockResolvedValue(true),
}));

const REPO: RepoInfo = {
  root: "/tmp/mi-repo",
  name: "mi-repo",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "aaaa0000",
  git_version: "2.50.1",
};

const handlers = { onFetch: vi.fn(), onPull: vi.fn(), onPush: vi.fn(), onRefresh: vi.fn() };

function entries(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    kind: "ordinary" as const,
    xy: ".M",
    path: `f${index}.txt`,
    orig_path: null,
  }));
}

describe("Toolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useRemoteStore.setState({ running: false });
    useStatusStore.setState({ report: null });
    useExtrasStore.setState({ remotes: [] });
    useUiStore.setState({ newBranchRequest: 0, newStashRequest: 0 });
  });

  it("muestra el nombre del repo, no la ruta completa", () => {
    render(<Toolbar {...handlers} />);

    expect(screen.getByText("mi-repo")).toBeInTheDocument();
    expect(screen.queryByText("/tmp/mi-repo")).not.toBeInTheDocument();
  });

  it("pone en el badge de Commit el número de cambios", () => {
    useStatusStore.setState({
      report: {
        head: "aaaa0000",
        branch: "main",
        detached: false,
        upstream: null,
        ahead: 0,
        behind: 0,
        entries: entries(3),
      },
    });
    render(<Toolbar {...handlers} />);

    expect(screen.getByRole("button", { name: /Commit/ })).toHaveTextContent("3");
  });

  it("oculta el badge cuando no hay cambios", () => {
    render(<Toolbar {...handlers} />);

    expect(screen.getByRole("button", { name: /Commit/ })).not.toHaveTextContent("0");
  });

  it("deshabilita las acciones de red mientras hay una operación en curso", () => {
    useRemoteStore.setState({ running: true });
    render(<Toolbar {...handlers} />);

    expect(screen.getByRole("button", { name: /Pull/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Push/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Fetch/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeEnabled();
  });

  it("sin repo abierto solo ofrece abrir", () => {
    useRepoStore.setState({ repo: null });
    render(<Toolbar {...handlers} />);

    expect(screen.getByRole("button", { name: /Open/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pull/ })).not.toBeInTheDocument();
    expect(screen.getByText("No repository open")).toBeInTheDocument();
  });

  it("Branch y Stash piden abrir sus formularios en la sidebar", async () => {
    const user = userEvent.setup();
    render(<Toolbar {...handlers} />);

    await user.click(screen.getByRole("button", { name: /Branch/ }));
    await user.click(screen.getByRole("button", { name: /Stash/ }));

    expect(useUiStore.getState().newBranchRequest).toBe(1);
    expect(useUiStore.getState().newStashRequest).toBe(1);
  });

  it("abre Finder y el terminal en la raíz del repo", async () => {
    const user = userEvent.setup();
    render(<Toolbar {...handlers} />);

    await user.click(screen.getByRole("button", { name: /Show in Finder/ }));
    await user.click(screen.getByRole("button", { name: /Terminal/ }));

    expect(revealInFileManager).toHaveBeenCalledWith("/tmp/mi-repo");
    expect(openTerminal).toHaveBeenCalledWith("/tmp/mi-repo");
  });

  it("deshabilita View Remote sin URL web y la abre cuando la hay", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Toolbar {...handlers} />);

    expect(screen.getByRole("button", { name: /View Remote/ })).toBeDisabled();

    useExtrasStore.setState({
      remotes: [{ name: "origin", url: "git@github.com:x/y.git", web_url: "https://x/y" }],
    });
    rerender(<Toolbar {...handlers} />);
    await user.click(screen.getByRole("button", { name: /View Remote/ }));

    expect(openExternal).toHaveBeenCalledWith("https://x/y");
  });

  it("cierra el popover de Settings con Escape", async () => {
    const user = userEvent.setup();
    render(<Toolbar {...handlers} />);

    await user.click(screen.getByRole("button", { name: /Settings/ }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
  });
});
