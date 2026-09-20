import { create } from "zustand";
import { setAutoRefresh as setAutoRefreshRequest } from "../bridge/settings";

export const AUTO_REFRESH_STORAGE_KEY = "opengit.autoRefresh";
export const RESTORE_TABS_STORAGE_KEY = "opengit.restoreTabs";

function loadBoolean(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === "true";
  } catch {
    return fallback;
  }
}

type SettingsState = {
  /** Watcher events reach the UI (OG-067 "Automatically refresh"). */
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
  /** Reopen the previous session's tabs on startup (OG-082). */
  restoreTabs: boolean;
  setRestoreTabs: (enabled: boolean) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  autoRefresh: loadBoolean(AUTO_REFRESH_STORAGE_KEY, true),
  setAutoRefresh: (enabled) => {
    try {
      localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, String(enabled));
    } catch {
      // Without storage the preference lives only in memory.
    }
    set({ autoRefresh: enabled });
    void setAutoRefreshRequest(enabled).catch(() => {
      // Without the backend (tests) the preference lives only in the store.
    });
  },
  restoreTabs: loadBoolean(RESTORE_TABS_STORAGE_KEY, true),
  setRestoreTabs: (enabled) => {
    try {
      localStorage.setItem(RESTORE_TABS_STORAGE_KEY, String(enabled));
    } catch {
      // Without storage the preference lives only in memory.
    }
    set({ restoreTabs: enabled });
  },
}));

/** Pushes the stored preference to the backend once, at startup. */
export function syncAutoRefresh(): void {
  void setAutoRefreshRequest(useSettingsStore.getState().autoRefresh).catch(() => {});
}
