import type { Commit } from "./bridge/types";
import { clampSize } from "./layout";

export type ColumnName = "hash" | "author" | "date";

/** Columns that can be sorted by (Description is not resizable). */
export type SortColumn = "description" | ColumnName;

export type SortOrder = {
  column: SortColumn;
  direction: "asc" | "desc";
};

export type ColumnWidths = Record<ColumnName, number>;

const STORAGE_KEY = "opengit.columns.commit-table";

export const COLUMN_DEFAULTS: ColumnWidths = { hash: 70, author: 140, date: 110 };
export const COLUMN_MIN = 48;
export const COLUMN_MAX = 420;

export const COLUMN_LABELS: Record<ColumnName, string> = {
  hash: "Commit",
  author: "Author",
  date: "Date",
};

/** Saved widths, sanitized: a corrupt value must not break the table. */
export function loadColumnWidths(): ColumnWidths {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return { ...COLUMN_DEFAULTS };
    }
    const parsed: unknown = JSON.parse(stored);
    if (parsed === null || typeof parsed !== "object") {
      return { ...COLUMN_DEFAULTS };
    }
    const raw = parsed as Partial<Record<ColumnName, unknown>>;
    const widths = { ...COLUMN_DEFAULTS };
    for (const name of Object.keys(COLUMN_DEFAULTS) as ColumnName[]) {
      const value = raw[name];
      if (typeof value === "number") {
        widths[name] = clampSize(value, COLUMN_MIN, COLUMN_MAX);
      }
    }
    return widths;
  } catch {
    return { ...COLUMN_DEFAULTS };
  }
}

export function saveColumnWidths(widths: ColumnWidths): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // Without storage the widths live only in memory.
  }
}

/**
 * Width resulting from dragging the left edge of a fixed column.
 *
 * The fixed columns are on the right and Description absorbs the rest, so
 * dragging to the left widens them: hence the inverted sign.
 */
export function widthAfterDrag(startWidth: number, deltaX: number): number {
  return clampSize(startWidth - deltaX, COLUMN_MIN, COLUMN_MAX);
}

function sortKey(commit: Commit, column: SortColumn): string | number {
  switch (column) {
    case "description":
      return commit.subject;
    case "hash":
      return commit.hash;
    case "author":
      return `${commit.author_name} <${commit.author_email}>`;
    case "date":
      return commit.author_time;
  }
}

/**
 * Presentation order of the table. With `order = null` the git order
 * (topological) is returned, the only one in which the graph makes sense.
 */
export function sortCommits(commits: Commit[], order: SortOrder | null): Commit[] {
  if (order === null) {
    return commits;
  }
  const factor = order.direction === "asc" ? 1 : -1;
  return [...commits].sort((a, b) => {
    const left = sortKey(a, order.column);
    const right = sortKey(b, order.column);
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * factor;
    }
    return String(left).localeCompare(String(right)) * factor;
  });
}

/** Cycle when clicking a header: ascending → descending → topological. */
export function nextSort(current: SortOrder | null, column: SortColumn): SortOrder | null {
  if (current?.column !== column) {
    return { column, direction: "asc" };
  }
  return current.direction === "asc" ? { column, direction: "desc" } : null;
}
