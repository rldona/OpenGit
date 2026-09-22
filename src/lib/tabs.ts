import type { RecentRepo } from "./bridge/types";

export const OPEN_TABS_STORAGE_KEY = "opengit.openTabs";

/** Session tab: the recent repository plus an optional custom label (OG-108). */
export type Tab = RecentRepo & { title?: string };

/** One persisted session entry; the title is only stored when set (OG-108). */
export type StoredTab = {
  path: string;
  title?: string;
};

/** Session persisted when the "reopen tabs" preference is on (OG-082). */
export type StoredSession = {
  tabs: StoredTab[];
  active: string | null;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Normalizes one stored entry; a malformed title is dropped, not the tab. */
function normalizeStoredTab(raw: unknown): StoredTab | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const { path, title } = raw as { path?: unknown; title?: unknown };
  if (typeof path !== "string") {
    return null;
  }
  const trimmed = typeof title === "string" ? title.trim() : "";
  return trimmed.length > 0 ? { path, title: trimmed } : { path };
}

/** Reads the stored session; `null` when there is none or it is malformed. */
export function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(OPEN_TABS_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const { tabs, paths, active } = parsed as {
      tabs?: unknown;
      paths?: unknown;
      active?: unknown;
    };
    if (active != null && typeof active !== "string") {
      return null;
    }
    const normalizedActive = typeof active === "string" ? active : null;
    if (Array.isArray(tabs)) {
      const stored: StoredTab[] = [];
      for (const entry of tabs) {
        const tab = normalizeStoredTab(entry);
        if (tab === null) {
          return null;
        }
        stored.push(tab);
      }
      return { tabs: stored, active: normalizedActive };
    }
    // Legacy shape from before titles existed (OG-108): normalize it on read.
    if (Array.isArray(paths)) {
      if (!isStringArray(paths)) {
        return null;
      }
      return { tabs: paths.map((path) => ({ path })), active: normalizedActive };
    }
    return null;
  } catch {
    return null;
  }
}

/** Persists the open tabs and the active one, including custom titles. */
export function saveStoredSession(
  tabs: Array<{ path: string; title?: string }>,
  active: string | null,
): void {
  try {
    const stored: StoredTab[] = tabs.map((tab) => {
      const title = tab.title?.trim();
      return title ? { path: tab.path, title } : { path: tab.path };
    });
    localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify({ tabs: stored, active }));
  } catch {
    // Storage is best-effort only.
  }
}

/** Forgets the session (preference off, or no tabs left). */
export function clearStoredSession(): void {
  try {
    localStorage.removeItem(OPEN_TABS_STORAGE_KEY);
  } catch {
    // Storage is best-effort only.
  }
}

/**
 * Applies a preference change: persists the current tabs when enabling,
 * clears the session when disabling.
 */
export function syncStoredSession(
  enabled: boolean,
  tabs: Array<{ path: string; title?: string }>,
  active: string | null,
): void {
  if (enabled) {
    saveStoredSession(tabs, active);
  } else {
    clearStoredSession();
  }
}
