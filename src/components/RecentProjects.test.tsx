import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "../lib/stores/repo";
import { RecentProjects } from "./RecentProjects";

const RECENTS = [
  { path: "/tmp/alpha", name: "alpha", opened_at: 2 },
  { path: "/tmp/beta", name: "beta", opened_at: 1 },
];

describe("RecentProjects", () => {
  const realActions = (() => {
    const { open, removeRecent } = useRepoStore.getState();
    return { open, removeRecent };
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

  it("renders nothing without recents", () => {
    render(<RecentProjects />);
    expect(screen.queryByText("Recent Projects")).not.toBeInTheDocument();
  });

  it("lists recents newest first with name, path and tooltip", () => {
    useRepoStore.setState({ recents: RECENTS });
    render(<RecentProjects />);

    expect(screen.getByText("Recent Projects")).toBeInTheDocument();
    const open = screen.getByRole("button", { name: /^alpha/ });
    expect(open).toHaveAttribute("title", "/tmp/alpha");
    expect(screen.getByText("/tmp/beta")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("opens a recent when clicked", async () => {
    const user = userEvent.setup();
    const open = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ recents: RECENTS, open });
    render(<RecentProjects />);

    await user.click(screen.getByRole("button", { name: /^beta/ }));

    expect(open).toHaveBeenCalledWith("/tmp/beta");
  });

  it("removes a recent without opening it", async () => {
    const user = userEvent.setup();
    const open = vi.fn().mockResolvedValue(undefined);
    const removeRecent = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ recents: RECENTS, open, removeRecent });
    render(<RecentProjects />);

    await user.click(screen.getByRole("button", { name: "Remove alpha from recent projects" }));

    expect(removeRecent).toHaveBeenCalledWith("/tmp/alpha");
    expect(open).not.toHaveBeenCalled();
  });
});
