import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelRemoteJob } from "../lib/bridge/jobs";
import { useRemoteStore } from "../lib/stores/remote";
import { RemoteJobModal } from "./RemoteJobModal";

vi.mock("../lib/bridge/jobs", () => ({
  startRemoteJob: vi.fn().mockResolvedValue("job-1"),
  cancelRemoteJob: vi.fn().mockResolvedValue(true),
}));

describe("RemoteJobModal", () => {
  beforeEach(() => {
    useRemoteStore.getState().reset();
  });

  it("renders nothing when there is no job or error", () => {
    const { container } = render(<RemoteJobModal />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the progress, the last line and the full output", async () => {
    const user = userEvent.setup();
    useRemoteStore.setState({
      running: true,
      jobId: "job-1",
      title: 'Pulling Branch "main" From "origin"',
      recentLines: ["From github.com:rldona/opengit", "Receiving objects: 42%"],
    });
    render(<RemoteJobModal />);

    expect(
      screen.getByRole("dialog", { name: 'Pulling Branch "main" From "origin"' }),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByText("Receiving objects: 42%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show Full Output" }));

    expect(screen.getByText(/Receiving objects: 42%/)).toBeInTheDocument();
    expect(screen.getByText(/From github.com/)).toBeInTheDocument();
  });

  it("cancels the running job", async () => {
    const user = userEvent.setup();
    useRemoteStore.setState({
      running: true,
      jobId: "job-1",
      title: "Fetching from origin",
      recentLines: [],
    });
    render(<RemoteJobModal />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(cancelRemoteJob).toHaveBeenCalledWith("job-1");
  });

  it("on failure it shows the error, the output and a Close that dismisses it", async () => {
    const user = userEvent.setup();
    useRemoteStore.setState({
      running: false,
      error: "Pull rejected: the remote has commits you do not have.",
      title: 'Pulling Branch "main" From "origin"',
      recentLines: ["fatal: refusing to merge unrelated histories"],
    });
    render(<RemoteJobModal />);

    expect(screen.getByRole("alert")).toHaveTextContent("Pull rejected");
    expect(screen.getByText(/refusing to merge unrelated histories/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(useRemoteStore.getState().error).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("without a percentage in the output the bar is indeterminate", () => {
    useRemoteStore.setState({
      running: true,
      jobId: "job-1",
      title: "Fetching from origin",
      recentLines: ["Enumerating objects"],
    });
    render(<RemoteJobModal />);

    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
});
