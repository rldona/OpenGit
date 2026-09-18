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
  it("muestra el hunk y permite stagearlo", async () => {
    const user = userEvent.setup();
    const props = renderPatch();

    expect(screen.getByText("@@ -1,3 +1,3 @@")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Stage hunk" }));

    expect(props.onApply).toHaveBeenCalledWith({ kind: "hunk", index: 0 });
  });

  it("etiqueta unstage cuando el parche viene del index", () => {
    renderPatch({ stagedSide: true });
    expect(screen.getByRole("button", { name: "Unstage hunk" })).toBeInTheDocument();
  });

  it("ofrece descartar el hunk en el lado unstaged", async () => {
    const user = userEvent.setup();
    const props = renderPatch({ onDiscard: vi.fn() });

    await user.click(screen.getByRole("button", { name: "Discard hunk" }));

    expect(props.onDiscard).toHaveBeenCalledWith({ kind: "hunk", index: 0 });
  });

  it("no ofrece descartar en el lado del index", () => {
    renderPatch({ stagedSide: true, onDiscard: vi.fn() });

    expect(screen.queryByRole("button", { name: "Discard hunk" })).not.toBeInTheDocument();
  });

  it("permite seleccionar líneas + y -", async () => {
    const user = userEvent.setup();
    const props = renderPatch();

    await user.click(screen.getByText("-dos"));
    await user.click(screen.getByText("+DOS"));

    expect(props.onToggleLine).toHaveBeenNthCalledWith(1, 6);
    expect(props.onToggleLine).toHaveBeenNthCalledWith(2, 7);
  });

  it("marca las líneas seleccionadas", () => {
    renderPatch({ selectedLines: [7] });
    expect(screen.getByText("+DOS").closest(".patch-line")).toHaveClass("selected");
  });

  it("sin staging no muestra acciones ni permite seleccionar", () => {
    const props = renderPatch({ staging: false });
    expect(screen.queryByRole("button", { name: "Stage hunk" })).not.toBeInTheDocument();
    expect(screen.getByText("-dos")).not.toHaveClass("selectable");
    expect(props.onToggleLine).not.toHaveBeenCalled();
  });
});
