export type ShortcutId =
  | "open"
  | "refresh"
  | "commit"
  | "search"
  | "viewStatus"
  | "viewHistory"
  | "viewDiff"
  | "prevTab"
  | "nextTab"
  | "help"
  | "close";

export type ShortcutGroup = "Repository" | "Commit" | "Navigation" | "Help";

export type Shortcut = {
  id: ShortcutId;
  keys: string;
  group: ShortcutGroup;
};

export const SHORTCUTS: Shortcut[] = [
  { id: "open", keys: "mod+o", group: "Repository" },
  { id: "refresh", keys: "mod+r", group: "Repository" },
  { id: "commit", keys: "mod+enter", group: "Commit" },
  { id: "search", keys: "mod+f", group: "Navigation" },
  { id: "viewStatus", keys: "mod+1", group: "Navigation" },
  { id: "viewHistory", keys: "mod+2", group: "Navigation" },
  { id: "viewDiff", keys: "mod+3", group: "Navigation" },
  { id: "prevTab", keys: "mod+shift+[", group: "Navigation" },
  { id: "nextTab", keys: "mod+shift+]", group: "Navigation" },
  { id: "help", keys: "?", group: "Help" },
  { id: "close", keys: "escape", group: "Help" },
];

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /mac/i.test(navigator.platform || navigator.userAgent);
}

export function parseKeys(keys: string): { mod: boolean; shift: boolean; key: string } {
  const parts = keys.toLowerCase().split("+");
  return {
    mod: parts.includes("mod"),
    shift: parts.includes("shift"),
    key: parts[parts.length - 1],
  };
}

export function matchesShortcut(event: KeyboardEvent, keys: string): boolean {
  if (event.altKey) {
    return false;
  }
  const { mod, shift, key } = parseKeys(keys);
  const primary = isMacPlatform() ? event.metaKey : event.ctrlKey;
  if (mod !== primary) {
    return false;
  }
  // Definitions with `shift` require it; without it Shift is ignored as
  // before (backwards compatible, and `?` keeps its special case below).
  if (shift && !event.shiftKey) {
    return false;
  }
  const pressed = event.key.toLowerCase();
  if (key === "?") {
    return pressed === "?" || (pressed === "/" && event.shiftKey);
  }
  return pressed === key;
}

export function formatKeys(keys: string): string {
  const { mod, shift, key } = parseKeys(keys);
  const base = key === "enter" ? "Enter" : key === "escape" ? "Esc" : key.toUpperCase();
  if (isMacPlatform()) {
    return `${mod ? "⌘" : ""}${shift ? "⇧" : ""}${base}`;
  }
  const prefix = [mod ? "Ctrl" : null, shift ? "Shift" : null].filter(Boolean).join("+");
  return prefix ? `${prefix}+${base}` : base;
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
