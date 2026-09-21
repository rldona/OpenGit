import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startRemoteJob } from "../lib/bridge/jobs";
import type { RepoInfo } from "../lib/bridge/types";
import { useExtrasStore } from "../lib/stores/extras";
import { useLocaleStore } from "../lib/stores/locale";
import { useRefsStore } from "../lib/stores/refs";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";
import { FetchDialog } from "./FetchDialog";

vi.mock("../lib/bridge/jobs", () => ({
  startRemoteJob: vi.fn().mockResolvedValue("job-1"),
  cancelRemoteJob: vi.fn().mockResolvedValue(true),
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

describe("FetchDialog", () => {
  beforeEach(() => {
    useRepoStore.setState({ repo: REPO });
    useExtrasStore.setState({
      remotes: [{ name: "origin", url: "git@github.com:rldona/opengit.git", web_url: null }],
    });
    useRefsStore.setState({ root: REPO.root, current: "main", upstream: "origin/main", refs: [] });
    useRemoteStore.getState().reset();
    useLocaleStore.setState({ preference: null, locale: "en" });
  });

  it("renders the dialog in Spanish", () => {
    useLocaleStore.setState({ preference: "es", locale: "es" });
    render(<FetchDialog onClose={() => {}} />);

    expect(screen.getByLabelText("Descargar desde el repositorio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
  });

  it("starts with the upstream remote", () => {
    render(<FetchDialog onClose={() => {}} />);

    expect(screen.getByLabelText("Fetch from repository")).toHaveValue("origin");
    expect(screen.getByText("git@github.com:rldona/opengit.git")).toBeInTheDocument();
  });

  it("starts a fetch of the remote with optional prune", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FetchDialog onClose={onClose} />);

    await user.click(screen.getByLabelText(/Prune tracking branches/));
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(startRemoteJob).toHaveBeenCalledWith("/tmp/repo", {
      kind: "fetch",
      remote: "origin",
      prune: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("with all remotes it ignores the selection", async () => {
    const user = userEvent.setup();
    render(<FetchDialog onClose={() => {}} />);

    await user.click(screen.getByLabelText(/Fetch all remotes/));
    expect(screen.getByLabelText("Fetch from repository")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(startRemoteJob).toHaveBeenCalledWith("/tmp/repo", {
      kind: "fetch",
      remote: null,
      prune: false,
    });
  });

  it("cancel closes without starting anything", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FetchDialog onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(startRemoteJob).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
