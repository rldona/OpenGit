import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickDirectory } from "../lib/bridge/dialog";
import { useRemoteStore } from "../lib/stores/remote";
import { CloneDialog } from "./CloneDialog";

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
}));

describe("CloneDialog", () => {
  beforeEach(() => {
    useRemoteStore.getState().reset();
    vi.mocked(pickDirectory).mockResolvedValue("/tmp/clones");
  });

  it("starts a clone job with the chosen destination", async () => {
    const user = userEvent.setup();
    const start = vi.spyOn(useRemoteStore.getState(), "start").mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<CloneDialog onClose={onClose} />);

    await user.type(screen.getByLabelText("Repository URL"), "https://github.com/user/repo.git");
    expect(screen.getByLabelText("Folder name")).toHaveValue("repo");

    await user.click(screen.getByRole("button", { name: "Choose…" }));
    await user.click(screen.getByRole("button", { name: "Clone" }));

    expect(start).toHaveBeenCalledWith("/tmp/clones", {
      kind: "clone",
      url: "https://github.com/user/repo.git",
      destination: "/tmp/clones/repo",
      depth: null,
      branch: null,
      recurse_submodules: false,
    });
    expect(onClose).toHaveBeenCalled();
    start.mockRestore();
  });

  it("keeps Clone disabled until the URL and the destination are set", async () => {
    const user = userEvent.setup();
    render(<CloneDialog onClose={() => {}} />);

    expect(screen.getByRole("button", { name: "Clone" })).toBeDisabled();

    await user.type(screen.getByLabelText("Repository URL"), "https://example.com/r.git");
    expect(screen.getByRole("button", { name: "Clone" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Choose…" }));
    expect(screen.getByRole("button", { name: "Clone" })).toBeEnabled();
  });
});
