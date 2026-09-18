export type ShortcutId =
  "open" | "refresh" | "commit" | "viewStatus" | "viewHistory" | "viewDiff" | "help" | "close";

export type ShortcutGroup = "Repository" | "Commit" | "Navigation" | "Help";

export type Shortcut = {
  id: ShortcutId;
  keys: string;
  label: string;
  group: ShortcutGroup;
};

export const SHORTCUTS: Shortcut[] = [
  { id: "open", keys: "mod+o", label: "Open repository", group: "Repository" },
  { id: "refresh", keys: "mod+r", label: "Refresh status, refs and history", group: "Repository" },
  { id: "commit", keys: "mod+enter", label: "Commit staged changes", group: "Commit" },
  { id: "viewStatus", keys: "mod+1", label: "File status", group: "Navigation" },
  { id: "viewHistory", keys: "mod+2", label: "History", group: "Navigation" },
  { id: "viewDiff", keys: "mod+3", label: "Diff", group: "Navigation" },
  { id: "help", keys: "?", label: "Keyboard shortcuts", group: "Help" },
  { id: "close", keys: "escape", label: "Close dialog or clear selection", group: "Help" },
];

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /mac/i.test(navigator.platform || navigator.userAgent);
}

export function parseKeys(keys: string): { mod: boolean; key: string } {
  const parts = keys.toLowerCase().split("+");
  return { mod: parts.includes("mod"), key: parts[parts.length - 1] };
}

export function matchesShortcut(event: KeyboardEvent, keys: string): boolean {
  if (event.altKey) {
    return false;
  }
  const { mod, key } = parseKeys(keys);
  const primary = isMacPlatform() ? event.metaKey : event.ctrlKey;
  if (mod !== primary) {
    return false;
  }
  const pressed = event.key.toLowerCase();
  if (key === "?") {
    return pressed === "?" || (pressed === "/" && event.shiftKey);
  }
  return pressed === key;
}

export function formatKeys(keys: string): string {
  const { mod, key } = parseKeys(keys);
  const base = key === "enter" ? "Enter" : key === "escape" ? "Esc" : key.toUpperCase();
  if (!mod) {
    return base;
  }
  return isMacPlatform() ? `⌘${base}` : `Ctrl+${base}`;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
