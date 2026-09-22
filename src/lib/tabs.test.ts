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

  it("round-trips the tabs, their titles and the active repository", () => {
    saveStoredSession([{ path: "/a", title: "Alpha" }, { path: "/b" }], "/b");

    expect(loadStoredSession()).toEqual({
      tabs: [{ path: "/a", title: "Alpha" }, { path: "/b" }],
      active: "/b",
    });
  });

  it("omits an empty title from storage", () => {
    saveStoredSession([{ path: "/a", title: "   " }], "/a");

    expect(loadStoredSession()).toEqual({ tabs: [{ path: "/a" }], active: "/a" });
    expect(localStorage.getItem(OPEN_TABS_STORAGE_KEY)).not.toContain("title");
  });

  it("loads the legacy { paths, active } shape", () => {
    localStorage.setItem(
      OPEN_TABS_STORAGE_KEY,
      JSON.stringify({ paths: ["/a", "/b"], active: "/a" }),
    );

    expect(loadStoredSession()).toEqual({
      tabs: [{ path: "/a" }, { path: "/b" }],
      active: "/a",
    });
  });

  it("has no session before anything is stored", () => {
    expect(loadStoredSession()).toBeNull();
  });

  it("ignores malformed storage", () => {
    localStorage.setItem(OPEN_TABS_STORAGE_KEY, "not json");
    expect(loadStoredSession()).toBeNull();

    localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify({ tabs: [1, 2], active: null }));
    expect(loadStoredSession()).toBeNull();

    localStorage.setItem(
      OPEN_TABS_STORAGE_KEY,
      JSON.stringify({ tabs: [{ path: 7 }], active: null }),
    );
    expect(loadStoredSession()).toBeNull();

    localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify({ paths: [1, 2], active: null }));
    expect(loadStoredSession()).toBeNull();

    localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify({ active: "/a" }));
    expect(loadStoredSession()).toBeNull();
  });

  it("drops a malformed title without discarding the tab", () => {
    localStorage.setItem(
      OPEN_TABS_STORAGE_KEY,
      JSON.stringify({
        tabs: [
          { path: "/a", title: 42 },
          { path: "/b", title: "Beta" },
        ],
        active: "/b",
      }),
    );

    expect(loadStoredSession()).toEqual({
      tabs: [{ path: "/a" }, { path: "/b", title: "Beta" }],
      active: "/b",
    });
  });

  it("treats a missing active as null", () => {
    localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify({ tabs: [{ path: "/a" }] }));
    expect(loadStoredSession()).toEqual({ tabs: [{ path: "/a" }], active: null });
  });

  it("clears the session", () => {
    saveStoredSession([{ path: "/a" }], "/a");
    clearStoredSession();

    expect(loadStoredSession()).toBeNull();
  });

  it("syncs on a preference change", () => {
    syncStoredSession(true, [{ path: "/a", title: "Alpha" }], "/a");
    expect(loadStoredSession()).toEqual({ tabs: [{ path: "/a", title: "Alpha" }], active: "/a" });

    syncStoredSession(false, [], null);
    expect(loadStoredSession()).toBeNull();
  });
});
