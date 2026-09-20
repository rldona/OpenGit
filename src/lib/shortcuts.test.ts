import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatKeys,
  isEditableTarget,
  isMacPlatform,
  matchesShortcut,
  parseKeys,
} from "./shortcuts";

type EventInit = {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

function keydown(init: EventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("matchesShortcut", () => {
  it("fuera de macOS usa Ctrl como modificador primario", () => {
    expect(matchesShortcut(keydown({ key: "o", ctrlKey: true }), "mod+o")).toBe(true);
    expect(matchesShortcut(keydown({ key: "o", metaKey: true }), "mod+o")).toBe(false);
    expect(matchesShortcut(keydown({ key: "o" }), "mod+o")).toBe(false);
  });

  it("en macOS usa Cmd", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    expect(isMacPlatform()).toBe(true);
    expect(matchesShortcut(keydown({ key: "o", metaKey: true }), "mod+o")).toBe(true);
    expect(matchesShortcut(keydown({ key: "o", ctrlKey: true }), "mod+o")).toBe(false);
  });

  it("ignora combinaciones con Alt", () => {
    expect(matchesShortcut(keydown({ key: "o", ctrlKey: true, altKey: true }), "mod+o")).toBe(
      false,
    );
  });

  it("reconoce ?, / con Shift, Enter y Escape", () => {
    expect(matchesShortcut(keydown({ key: "?" }), "?")).toBe(true);
    expect(matchesShortcut(keydown({ key: "/", shiftKey: true }), "?")).toBe(true);
    expect(matchesShortcut(keydown({ key: "/" }), "?")).toBe(false);
    expect(matchesShortcut(keydown({ key: "Enter", ctrlKey: true }), "mod+enter")).toBe(true);
    expect(matchesShortcut(keydown({ key: "Escape" }), "escape")).toBe(true);
  });
});

describe("formatKeys", () => {
  it("etiqueta los atajos según la plataforma", () => {
    expect(formatKeys("mod+o")).toBe("Ctrl+O");
    expect(formatKeys("mod+enter")).toBe("Ctrl+Enter");
    expect(formatKeys("escape")).toBe("Esc");
    expect(formatKeys("?")).toBe("?");

    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    expect(formatKeys("mod+o")).toBe("⌘O");
  });
});

describe("parseKeys", () => {
  it("separa mod de la tecla", () => {
    expect(parseKeys("mod+enter")).toEqual({ mod: true, key: "enter" });
    expect(parseKeys("escape")).toEqual({ mod: false, key: "escape" });
  });
});

describe("isEditableTarget", () => {
  it("detecta campos de texto y selects", () => {
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(document.createElement("select"))).toBe(true);
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
