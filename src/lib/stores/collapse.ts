import { create } from "zustand";

const STORAGE_KEY = "opengit.sidebar.collapsed";

/**
 * Sections that start collapsed the first time. Remotes collapse by
 * default because a repo with many remote branches pushes everything
 * below them (tags, stashes, submodules) out of view.
 */
const DEFAULT_COLLAPSED = ["recents"];

function load(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return Object.fromEntries(DEFAULT_COLLAPSED.map((id) => [id, true]));
    }
    const parsed: unknown = JSON.parse(stored);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([, value]) => typeof value === "boolean",
    ) as [string, boolean][];
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function save(collapsed: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
  } catch {
    // Without storage the collapsed state lives only in memory.
  }
}

type CollapseState = {
  collapsed: Record<string, boolean>;
  isCollapsed: (id: string, fallback?: boolean) => boolean;
  toggle: (id: string, fallback?: boolean) => void;
  set: (id: string, collapsed: boolean) => void;
};

export const useCollapseStore = create<CollapseState>((set, get) => ({
  collapsed: load(),
  isCollapsed: (id, fallback = false) => get().collapsed[id] ?? fallback,
  toggle: (id, fallback = false) =>
    set((state) => {
      const next = { ...state.collapsed, [id]: !(state.collapsed[id] ?? fallback) };
      save(next);
      return { collapsed: next };
    }),
  set: (id, collapsed) =>
    set((state) => {
      const next = { ...state.collapsed, [id]: collapsed };
      save(next);
      return { collapsed: next };
    }),
}));
