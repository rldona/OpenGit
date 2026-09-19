import type { Commit } from "./bridge/types";
import { clampSize } from "./layout";

export type ColumnName = "hash" | "author" | "date";

/** Columnas por las que se puede ordenar (Description no es redimensionable). */
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

/** Anchos guardados, saneados: un valor corrupto no debe romper la tabla. */
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
    // Sin almacenamiento los anchos viven solo en memoria.
  }
}

/**
 * Ancho resultante de arrastrar el borde izquierdo de una columna fija.
 *
 * Las columnas fijas están a la derecha y Description absorbe el resto, así que
 * arrastrar hacia la izquierda las ensancha: de ahí el signo invertido.
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
 * Orden de presentación de la tabla. Con `order = null` se devuelve el orden
 * de git (topológico), que es el único en el que el grafo tiene sentido.
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

/** Ciclo al pulsar una cabecera: ascendente → descendente → topológico. */
export function nextSort(current: SortOrder | null, column: SortColumn): SortOrder | null {
  if (current?.column !== column) {
    return { column, direction: "asc" };
  }
  return current.direction === "asc" ? { column, direction: "desc" } : null;
}
