export const OPEN_TABS_STORAGE_KEY = "opengit.openTabs";

/** Session persisted when the "reopen tabs" preference is on (OG-082). */
export type StoredSession = {
  paths: string[];
  active: string | null;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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
    const { paths, active } = parsed as { paths?: unknown; active?: unknown };
    if (!isStringArray(paths) || (active != null && typeof active !== "string")) {
      return null;
    }
    return { paths, active: typeof active === "string" ? active : null };
  } catch {
    return null;
  }
}

/** Persists the open tabs and the active one. */
export function saveStoredSession(tabs: Array<{ path: string }>, active: string | null): void {
  try {
    localStorage.setItem(
      OPEN_TABS_STORAGE_KEY,
      JSON.stringify({ paths: tabs.map((tab) => tab.path), active }),
    );
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
  tabs: Array<{ path: string }>,
  active: string | null,
): void {
  if (enabled) {
    saveStoredSession(tabs, active);
  } else {
    clearStoredSession();
  }
}
