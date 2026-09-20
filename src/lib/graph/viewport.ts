import { ROW_HEIGHT } from "./layout";

export type VisibleRange = {
  start: number;
  end: number;
};

/**
 * Ventana de filas a montar para un scroll dado. Solo cambia al cruzar
 * límites de fila, así el scroll no provoca renders por píxel.
 */
export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowCount: number,
  overscan = 6,
  rowHeight = ROW_HEIGHT,
): VisibleRange {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { start, end };
}

export function sameRange(a: VisibleRange, b: VisibleRange): boolean {
  return a.start === b.start && a.end === b.end;
}
