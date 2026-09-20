import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useContextMenu } from "../lib/hooks/useContextMenu";

function Harness({ onSelect }: { onSelect: () => void }) {
  const menu = useContextMenu();
  return (
    <div>
      <button
        type="button"
        onClick={(event) =>
          menu.open(event, [
            { label: "View diff", onSelect },
            { label: "Delete", danger: true, onSelect },
          ])
        }
      >
        open
      </button>
      {menu.menu}
    </div>
  );
}

describe("ContextMenu", () => {
  it("abre, ejecuta la acción y se cierra", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "open" }), { clientX: 10, clientY: 20 });
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "View diff" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("se cierra con Escape", () => {
    render(<Harness onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("se cierra con un click fuera", () => {
    render(<Harness onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
