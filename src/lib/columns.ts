import { clampSize } from "./layout";

export type ColumnName = "hash" | "author" | "date";

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
