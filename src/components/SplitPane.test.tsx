import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SplitPane } from "./SplitPane";

function renderPane(overrides: Partial<Parameters<typeof SplitPane>[0]> = {}) {
  return render(
    <SplitPane
      direction="horizontal"
      side="start"
      storageKey="test.size"
      defaultSize={240}
      min={100}
      max={400}
      label="Resize sidebar"
      {...overrides}
    >
      <div>first</div>
      <div>second</div>
    </SplitPane>,
  );
}

describe("SplitPane", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders both panes and the divider", () => {
    renderPane();

    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize sidebar" })).toHaveAttribute(
      "aria-valuenow",
      "240",
    );
  });

  it("adjusts the size with the arrow keys and persists it", () => {
    renderPane();
    const separator = screen.getByRole("separator", { name: "Resize sidebar" });

    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "250");

    fireEvent.keyDown(separator, { key: "ArrowLeft", shiftKey: true });
    expect(separator).toHaveAttribute("aria-valuenow", "210");

    expect(localStorage.getItem("test.size")).toBe("210");
  });

  it("with the pane at the end it inverts the direction", () => {
    renderPane({ side: "end" });
    const separator = screen.getByRole("separator", { name: "Resize sidebar" });

    fireEvent.keyDown(separator, { key: "ArrowRight" });

    expect(separator).toHaveAttribute("aria-valuenow", "230");
  });

  it("respects the limits", () => {
    renderPane({ defaultSize: 110 });
    const separator = screen.getByRole("separator", { name: "Resize sidebar" });

    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(separator).toHaveAttribute("aria-valuenow", "100");

    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    expect(separator).toHaveAttribute("aria-valuenow", "400");
  });

  it("loads the saved size", () => {
    localStorage.setItem("test.size", "320");
    renderPane();

    expect(screen.getByRole("separator", { name: "Resize sidebar" })).toHaveAttribute(
      "aria-valuenow",
      "320",
    );
  });

  it("collapsed hides the end pane and the divider", () => {
    renderPane({ side: "end", collapsed: true });

    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.queryByText("second")).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });
});
