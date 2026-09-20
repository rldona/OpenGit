import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickDirectory } from "../lib/bridge/dialog";
import { gitignoreTemplates, initRepo } from "../lib/bridge/repo";
import { useRepoStore } from "../lib/stores/repo";
import { CreateDialog } from "./CreateDialog";

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
}));

vi.mock("../lib/bridge/repo", () => ({
  initRepo: vi.fn().mockResolvedValue(undefined),
  gitignoreTemplates: vi.fn().mockResolvedValue([{ id: "rust", name: "Rust" }]),
}));

describe("CreateDialog", () => {
  beforeEach(() => {
    vi.mocked(pickDirectory).mockResolvedValue("/tmp/work");
    vi.mocked(initRepo).mockResolvedValue(undefined);
    vi.mocked(gitignoreTemplates).mockResolvedValue([{ id: "rust", name: "Rust" }]);
  });

  it("creates the repository with the chosen options and opens it", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(useRepoStore.getState(), "open").mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<CreateDialog onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Choose…" }));
    await user.type(screen.getByLabelText("Folder name"), "project");
    await user.selectOptions(await screen.findByLabelText(".gitignore template"), "rust");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(initRepo).toHaveBeenCalledWith("/tmp/work/project", "main", "rust", true);
    expect(open).toHaveBeenCalledWith("/tmp/work/project");
    expect(onClose).toHaveBeenCalled();
    open.mockRestore();
  });

  it("keeps Create disabled until the destination is set", async () => {
    const user = userEvent.setup();
    render(<CreateDialog onClose={() => {}} />);

    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();

    await user.type(screen.getByLabelText("Folder name"), "project");
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Choose…" }));
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("reports a failure without opening anything", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(useRepoStore.getState(), "open").mockResolvedValue(undefined);
    vi.mocked(initRepo).mockRejectedValue(new Error("the destination folder is not empty"));
    render(<CreateDialog onClose={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Choose…" }));
    await user.type(screen.getByLabelText("Folder name"), "project");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not empty");
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});
