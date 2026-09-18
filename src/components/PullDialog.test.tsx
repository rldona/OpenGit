import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startRemoteJob } from "../lib/bridge/jobs";
import type { RefEntry, RepoInfo } from "../lib/bridge/types";
import { useExtrasStore } from "../lib/stores/extras";
import { useRefsStore } from "../lib/stores/refs";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";
import { PullDialog } from "./PullDialog";

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

const branch = (name: string): RefEntry => ({
  name,
  object_id: "a",
  object_type: "commit",
  upstream: null,
  track: null,
});

describe("PullDialog", () => {
  beforeEach(() => {
    useRepoStore.setState({ repo: REPO });
    useExtrasStore.setState({
      remotes: [{ name: "origin", url: "git@github.com:rldona/opengit.git", web_url: null }],
    });
    useRefsStore.setState({
      root: REPO.root,
      current: "main",
      upstream: "origin/main",
      refs: [
        branch("refs/remotes/origin/HEAD"),
        branch("refs/remotes/origin/main"),
        branch("refs/remotes/origin/dev"),
      ],
    });
    useRemoteStore.getState().reset();
  });

  it("arranca con el remoto y la rama del upstream", () => {
    render(<PullDialog onClose={() => {}} />);

    expect(screen.getByLabelText("Pull from repository")).toHaveValue("origin");
    expect(screen.getByLabelText("Remote branch to pull")).toHaveValue("main");
    expect(screen.getByText("git@github.com:rldona/opengit.git")).toBeInTheDocument();
    expect(screen.getByText("main", { selector: ".remote-value" })).toBeInTheDocument();
  });

  it("lanza el pull con las opciones por defecto", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PullDialog onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(startRemoteJob).toHaveBeenCalledWith("/tmp/repo", {
      kind: "pull",
      remote: "origin",
      branch: "main",
      rebase: false,
      no_ff: false,
      no_commit: false,
      include_messages: false,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("traduce las casillas a flags de git", async () => {
    const user = userEvent.setup();
    render(<PullDialog onClose={() => {}} />);

    await user.click(screen.getByLabelText(/Commit merged changes immediately/));
    await user.click(screen.getByLabelText(/Include messages from commits/));
    await user.click(screen.getByLabelText(/Create new commit even if fast-forward/));
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(startRemoteJob).toHaveBeenCalledWith(
      "/tmp/repo",
      expect.objectContaining({
        no_commit: true,
        include_messages: true,
        no_ff: true,
        rebase: false,
      }),
    );
  });

  it("con rebase desactiva las opciones de merge", async () => {
    const user = userEvent.setup();
    render(<PullDialog onClose={() => {}} />);

    await user.click(screen.getByLabelText(/Rebase instead of merge/));

    expect(screen.getByLabelText(/Create new commit even if fast-forward/)).toBeDisabled();
    expect(screen.getByLabelText(/Include messages from commits/)).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(startRemoteJob).toHaveBeenCalledWith(
      "/tmp/repo",
      expect.objectContaining({ rebase: true, no_ff: false, no_commit: false }),
    );
  });

  it("cancelar cierra sin lanzar nada", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PullDialog onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(startRemoteJob).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
