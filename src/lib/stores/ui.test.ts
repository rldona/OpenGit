import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./ui";

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState({ outputOpen: true, outputLines: [] });
  });

  it("alterna el panel de salida", () => {
    useUiStore.getState().toggleOutput();
    expect(useUiStore.getState().outputOpen).toBe(false);

    useUiStore.getState().toggleOutput();
    expect(useUiStore.getState().outputOpen).toBe(true);
  });

  it("acumula líneas de salida", () => {
    useUiStore.getState().appendOutput("primera");
    useUiStore.getState().appendOutput("segunda");
    expect(useUiStore.getState().outputLines).toEqual(["primera", "segunda"]);
  });
});
