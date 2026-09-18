import { create } from "zustand";

const STORAGE_KEY = "opengit.sidebar.collapsed";

/**
 * Secciones que arrancan plegadas la primera vez. Los remotos se pliegan por
 * defecto porque un repo con muchas ramas remotas expulsa de la vista todo lo
 * que hay debajo (tags, stashes, submódulos).
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
    // Sin almacenamiento el plegado vive solo en memoria.
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
