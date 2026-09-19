import { create } from "zustand";
import { setAutoRefresh as setAutoRefreshRequest } from "../bridge/settings";

export const AUTO_REFRESH_STORAGE_KEY = "opengit.autoRefresh";

function loadAutoRefresh(): boolean {
  try {
    const stored = localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

type SettingsState = {
  /** Watcher events reach the UI (OG-067 "Automatically refresh"). */
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  autoRefresh: loadAutoRefresh(),
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
}));

/** Pushes the stored preference to the backend once, at startup. */
export function syncAutoRefresh(): void {
  void setAutoRefreshRequest(useSettingsStore.getState().autoRefresh).catch(() => {});
}
