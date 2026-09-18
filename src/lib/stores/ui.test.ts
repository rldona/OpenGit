import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./ui";

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState({ outputOpen: true });
  });

  it("alterna el panel de salida", () => {
    useUiStore.getState().toggleOutput();
    expect(useUiStore.getState().outputOpen).toBe(false);

    useUiStore.getState().toggleOutput();
    expect(useUiStore.getState().outputOpen).toBe(true);
  });
});
