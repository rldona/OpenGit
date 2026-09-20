import { beforeEach, describe, expect, it } from "vitest";
import { AUTO_REFRESH_STORAGE_KEY, RESTORE_TABS_STORAGE_KEY, useSettingsStore } from "./settings";

describe("settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reopens the previous session by default on a fresh install", () => {
    // The store is created at import time with an empty localStorage.
    expect(useSettingsStore.getState().restoreTabs).toBe(true);
    expect(useSettingsStore.getState().autoRefresh).toBe(true);
  });

  it("persists the restore-tabs preference", () => {
    useSettingsStore.getState().setRestoreTabs(false);
    expect(useSettingsStore.getState().restoreTabs).toBe(false);
    expect(localStorage.getItem(RESTORE_TABS_STORAGE_KEY)).toBe("false");

    useSettingsStore.getState().setRestoreTabs(true);
    expect(localStorage.getItem(RESTORE_TABS_STORAGE_KEY)).toBe("true");
    expect(localStorage.getItem(AUTO_REFRESH_STORAGE_KEY)).toBeNull();
  });
});
