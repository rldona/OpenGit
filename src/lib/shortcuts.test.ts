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
  it("outside macOS uses Ctrl as the primary modifier", () => {
    expect(matchesShortcut(keydown({ key: "o", ctrlKey: true }), "mod+o")).toBe(true);
    expect(matchesShortcut(keydown({ key: "o", metaKey: true }), "mod+o")).toBe(false);
    expect(matchesShortcut(keydown({ key: "o" }), "mod+o")).toBe(false);
  });

  it("on macOS uses Cmd", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    expect(isMacPlatform()).toBe(true);
    expect(matchesShortcut(keydown({ key: "o", metaKey: true }), "mod+o")).toBe(true);
    expect(matchesShortcut(keydown({ key: "o", ctrlKey: true }), "mod+o")).toBe(false);
  });

  it("ignores combinations with Alt", () => {
    expect(matchesShortcut(keydown({ key: "o", ctrlKey: true, altKey: true }), "mod+o")).toBe(
      false,
    );
  });

  it("recognizes ?, / with Shift, Enter and Escape", () => {
    expect(matchesShortcut(keydown({ key: "?" }), "?")).toBe(true);
    expect(matchesShortcut(keydown({ key: "/", shiftKey: true }), "?")).toBe(true);
    expect(matchesShortcut(keydown({ key: "/" }), "?")).toBe(false);
    expect(matchesShortcut(keydown({ key: "Enter", ctrlKey: true }), "mod+enter")).toBe(true);
    expect(matchesShortcut(keydown({ key: "Escape" }), "escape")).toBe(true);
  });

  it("requires Shift only for definitions that include it", () => {
    expect(
      matchesShortcut(keydown({ key: "[", ctrlKey: true, shiftKey: true }), "mod+shift+["),
    ).toBe(true);
    expect(matchesShortcut(keydown({ key: "[", ctrlKey: true }), "mod+shift+[")).toBe(false);
    expect(
      matchesShortcut(keydown({ key: "]", ctrlKey: true, shiftKey: true }), "mod+shift+]"),
    ).toBe(true);
    // Definitions without `shift` keep ignoring it, as before.
    expect(matchesShortcut(keydown({ key: "o", ctrlKey: true, shiftKey: true }), "mod+o")).toBe(
      true,
    );
    expect(
      matchesShortcut(keydown({ key: "Enter", ctrlKey: true, shiftKey: true }), "mod+enter"),
    ).toBe(true);
  });
});

describe("formatKeys", () => {
  it("labels shortcuts according to the platform", () => {
    expect(formatKeys("mod+o")).toBe("Ctrl+O");
    expect(formatKeys("mod+enter")).toBe("Ctrl+Enter");
    expect(formatKeys("escape")).toBe("Esc");
    expect(formatKeys("?")).toBe("?");
    expect(formatKeys("mod+shift+[")).toBe("Ctrl+Shift+[");
    expect(formatKeys("mod+shift+]")).toBe("Ctrl+Shift+]");

    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    expect(formatKeys("mod+o")).toBe("⌘O");
    expect(formatKeys("mod+shift+[")).toBe("⌘⇧[");
  });
});

describe("parseKeys", () => {
  it("separates mod from the key", () => {
    expect(parseKeys("mod+enter")).toEqual({ mod: true, shift: false, key: "enter" });
    expect(parseKeys("escape")).toEqual({ mod: false, shift: false, key: "escape" });
    expect(parseKeys("mod+shift+[")).toEqual({ mod: true, shift: true, key: "[" });
  });
});

describe("isEditableTarget", () => {
  it("detects text fields and selects", () => {
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(document.createElement("select"))).toBe(true);
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
