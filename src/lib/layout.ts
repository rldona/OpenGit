export const LAYOUT_KEYS = {
  sidebar: "opengit.layout.sidebar",
  output: "opengit.layout.output",
  diffFiles: "opengit.layout.diff-files",
  historyBottom: "opengit.layout.history-bottom",
  historyFiles: "opengit.layout.history-files",
  historyMeta: "opengit.layout.history-meta",
  statusFiles: "opengit.layout.status-files",
  statusCommit: "opengit.layout.status-commit",
} as const;

export function clampSize(size: number, min: number, max: number): number {
  if (!Number.isFinite(size)) {
    return min;
  }
  return Math.min(Math.max(size, min), max);
}

export function loadSize(key: string, fallback: number, min: number, max: number): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      return fallback;
    }
    const parsed = Number.parseInt(stored, 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return clampSize(parsed, min, max);
  } catch {
    return fallback;
  }
}

export function saveSize(key: string, size: number): void {
  try {
    localStorage.setItem(key, String(Math.round(size)));
  } catch {
    // Sin almacenamiento el tamaño vive solo en memoria.
  }
}
