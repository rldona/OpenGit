import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PatchView } from "./PatchView";

const PATCH = [
  "diff --git a/a.txt b/a.txt",
  "index 1111111..2222222 100644",
  "--- a/a.txt",
  "+++ b/a.txt",
  "@@ -1,3 +1,3 @@",
  " uno",
  "-dos",
  "+DOS",
  " tres",
  "",
].join("\n");

function renderPatch(overrides: Partial<Parameters<typeof PatchView>[0]> = {}) {
  const props = {
    patch: PATCH,
    staging: true,
    stagedSide: false,
    selectedLines: [] as number[],
    onToggleLine: vi.fn(),
    onApply: vi.fn(),
    ...overrides,
  };
  render(<PatchView {...props} />);
  return props;
}

describe("PatchView", () => {
  it("shows the hunk and allows staging it", async () => {
    const user = userEvent.setup();
    const props = renderPatch();

    expect(screen.getByText("Hunk 1 · Lines 1–3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Stage hunk" }));

    expect(props.onApply).toHaveBeenCalledWith({ kind: "hunk", index: 0 });
  });

  it("numbers the old and new lines", () => {
    renderPatch();

    // context (1/1), deleted (2) and added (2) leave two "1"s and two "2"s visible
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(2);
  });

  it("labels unstage when the patch comes from the index", () => {
    renderPatch({ stagedSide: true });
    expect(screen.getByRole("button", { name: "Unstage hunk" })).toBeInTheDocument();
  });

  it("offers discarding the hunk on the unstaged side", async () => {
    const user = userEvent.setup();
    const props = renderPatch({ onDiscard: vi.fn() });

    await user.click(screen.getByRole("button", { name: "Discard hunk" }));

    expect(props.onDiscard).toHaveBeenCalledWith({ kind: "hunk", index: 0 });
  });

  it("does not offer discarding on the index side", () => {
    renderPatch({ stagedSide: true, onDiscard: vi.fn() });

    expect(screen.queryByRole("button", { name: "Discard hunk" })).not.toBeInTheDocument();
  });

  it("allows selecting + and - lines", async () => {
    const user = userEvent.setup();
    const props = renderPatch();

    await user.click(screen.getByText("-dos"));
    await user.click(screen.getByText("+DOS"));

    expect(props.onToggleLine).toHaveBeenNthCalledWith(1, 6);
    expect(props.onToggleLine).toHaveBeenNthCalledWith(2, 7);
  });

  it("marks the selected lines", () => {
    renderPatch({ selectedLines: [7] });
    expect(screen.getByText("+DOS").closest(".patch-line")).toHaveClass("selected");
  });

  it("without staging it shows no actions and does not allow selecting", () => {
    const props = renderPatch({ staging: false });
    expect(screen.queryByRole("button", { name: "Stage hunk" })).not.toBeInTheDocument();
    expect(screen.getByText("-dos")).not.toHaveClass("selectable");
    expect(props.onToggleLine).not.toHaveBeenCalled();
  });
});
