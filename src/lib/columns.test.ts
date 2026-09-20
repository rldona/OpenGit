import { beforeEach, describe, expect, it } from "vitest";
import type { Commit } from "./bridge/types";
import {
  COLUMN_DEFAULTS,
  COLUMN_MAX,
  COLUMN_MIN,
  loadColumnWidths,
  nextSort,
  saveColumnWidths,
  sortCommits,
  widthAfterDrag,
} from "./columns";

function commit(overrides: Partial<Commit> = {}): Commit {
  return {
    hash: "aaaa0001",
    parents: [],
    author_name: "Ana",
    author_email: "ana@example.com",
    author_time: 100,
    refs: [],
    subject: "uno",
    body: "",
    ...overrides,
  };
}

describe("widthAfterDrag", () => {
  it("widens when dragging to the left", () => {
    // Fixed columns are on the right: dragging their left edge
    // to the left makes them wider.
    expect(widthAfterDrag(100, -30)).toBe(130);
    expect(widthAfterDrag(100, 30)).toBe(70);
  });

  it("respects the minimum and the maximum", () => {
    expect(widthAfterDrag(COLUMN_MIN, 500)).toBe(COLUMN_MIN);
    expect(widthAfterDrag(COLUMN_MAX, -500)).toBe(COLUMN_MAX);
  });
});

describe("sortCommits", () => {
  const commits = [
    commit({ hash: "cccc", subject: "c", author_time: 100, author_name: "Zoe" }),
    commit({ hash: "aaaa", subject: "a", author_time: 300, author_name: "Ana" }),
    commit({ hash: "bbbb", subject: "b", author_time: 200, author_name: "Luis" }),
  ];

  it("with no sort returns the topological order as is", () => {
    expect(sortCommits(commits, null)).toBe(commits);
  });

  it("sorts by description, hash, author and date in both directions", () => {
    expect(
      sortCommits(commits, { column: "description", direction: "asc" }).map((c) => c.subject),
    ).toEqual(["a", "b", "c"]);
    expect(sortCommits(commits, { column: "hash", direction: "desc" }).map((c) => c.hash)).toEqual([
      "cccc",
      "bbbb",
      "aaaa",
    ]);
    expect(
      sortCommits(commits, { column: "author", direction: "asc" }).map((c) => c.author_name),
    ).toEqual(["Ana", "Luis", "Zoe"]);
    expect(
      sortCommits(commits, { column: "date", direction: "desc" }).map((c) => c.author_time),
    ).toEqual([300, 200, 100]);
  });
});

describe("nextSort", () => {
  it("cycles ascending → descending → topological", () => {
    const asc = nextSort(null, "description");
    expect(asc).toEqual({ column: "description", direction: "asc" });

    const desc = nextSort(asc, "description");
    expect(desc).toEqual({ column: "description", direction: "desc" });

    expect(nextSort(desc, "description")).toBeNull();
  });

  it("changing column starts ascending", () => {
    expect(nextSort({ column: "date", direction: "desc" }, "hash")).toEqual({
      column: "hash",
      direction: "asc",
    });
  });
});

describe("loadColumnWidths", () => {
  beforeEach(() => localStorage.clear());

  it("returns the defaults with nothing saved", () => {
    expect(loadColumnWidths()).toEqual(COLUMN_DEFAULTS);
  });

  it("recovers what was saved", () => {
    saveColumnWidths({ hash: 90, author: 200, date: 130 });

    expect(loadColumnWidths()).toEqual({ hash: 90, author: 200, date: 130 });
  });

  it("sanitizes corrupt values instead of breaking the table", () => {
    localStorage.setItem(
      "opengit.columns.commit-table",
      JSON.stringify({ hash: 9999, author: "ancho", date: -40 }),
    );

    const widths = loadColumnWidths();

    expect(widths.hash).toBe(COLUMN_MAX);
    expect(widths.author).toBe(COLUMN_DEFAULTS.author);
    expect(widths.date).toBe(COLUMN_MIN);
  });

  it("tolerates invalid JSON", () => {
    localStorage.setItem("opengit.columns.commit-table", "{no es json");

    expect(loadColumnWidths()).toEqual(COLUMN_DEFAULTS);
  });
});
