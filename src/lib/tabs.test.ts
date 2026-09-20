import { beforeEach, describe, expect, it } from "vitest";
import {
  clearStoredSession,
  loadStoredSession,
  OPEN_TABS_STORAGE_KEY,
  saveStoredSession,
  syncStoredSession,
} from "./tabs";

describe("stored session", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips the tabs and the active repository", () => {
    saveStoredSession([{ path: "/a" }, { path: "/b" }], "/b");

    expect(loadStoredSession()).toEqual({ paths: ["/a", "/b"], active: "/b" });
  });

  it("has no session before anything is stored", () => {
    expect(loadStoredSession()).toBeNull();
  });

  it("ignores malformed storage", () => {
    localStorage.setItem(OPEN_TABS_STORAGE_KEY, "not json");
    expect(loadStoredSession()).toBeNull();

    localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify({ paths: [1, 2], active: null }));
    expect(loadStoredSession()).toBeNull();

    localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify({ active: "/a" }));
    expect(loadStoredSession()).toBeNull();
  });

  it("treats a missing active as null", () => {
    localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify({ paths: ["/a"] }));
    expect(loadStoredSession()).toEqual({ paths: ["/a"], active: null });
  });

  it("clears the session", () => {
    saveStoredSession([{ path: "/a" }], "/a");
    clearStoredSession();

    expect(loadStoredSession()).toBeNull();
  });

  it("syncs on a preference change", () => {
    syncStoredSession(true, [{ path: "/a" }], "/a");
    expect(loadStoredSession()).toEqual({ paths: ["/a"], active: "/a" });

    syncStoredSession(false, [], null);
    expect(loadStoredSession()).toBeNull();
  });
});
