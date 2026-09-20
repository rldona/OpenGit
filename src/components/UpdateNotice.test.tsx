import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openExternal } from "../lib/bridge/opener";
import { useUpdateStore } from "../lib/stores/update";
import { UpdateNotice } from "./UpdateNotice";

vi.mock("../lib/bridge/opener", () => ({
  openExternal: vi.fn().mockResolvedValue(undefined),
  openTerminal: vi.fn().mockResolvedValue(undefined),
  revealInFileManager: vi.fn().mockResolvedValue(undefined),
}));

describe("UpdateNotice", () => {
  beforeEach(() => {
    useUpdateStore.getState().reset();
    vi.clearAllMocks();
  });

  it("renders nothing when idle or checking", () => {
    const { rerender } = render(<UpdateNotice />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    useUpdateStore.setState({ status: "checking" });
    rerender(<UpdateNotice />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers the download and dismisses", async () => {
    const user = userEvent.setup();
    useUpdateStore.setState({ status: "available", version: "v0.4.0" });
    render(<UpdateNotice />);

    expect(screen.getByText(/OpenGit v0\.4\.0 is available\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(openExternal).toHaveBeenCalledWith("https://github.com/rldona/OpenGit/releases/latest");

    await user.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reports up-to-date and failures from manual checks", () => {
    useUpdateStore.setState({ status: "up-to-date", version: "0.3.1" });
    const { unmount } = render(<UpdateNotice />);
    expect(screen.getByText("OpenGit is up to date.")).toBeInTheDocument();
    unmount();

    useUpdateStore.setState({ status: "error" });
    render(<UpdateNotice />);
    expect(screen.getByText("Could not check for updates.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
