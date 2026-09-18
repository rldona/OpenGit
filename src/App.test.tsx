import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { getAppVersion } from "./lib/bridge/core";

vi.mock("./lib/bridge/core", () => ({
  getAppVersion: vi.fn(),
}));

describe("App", () => {
  beforeEach(() => {
    vi.mocked(getAppVersion).mockResolvedValue("0.1.0");
  });

  it("muestra el layout base y la versión del núcleo", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sin repositorio abierto" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Salida" })).toBeInTheDocument();
    expect(await screen.findByText("núcleo v0.1.0")).toBeInTheDocument();
  });

  it("alterna el panel de salida", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Salida" }));

    expect(screen.queryByRole("region", { name: "Salida" })).not.toBeInTheDocument();
  });
});
