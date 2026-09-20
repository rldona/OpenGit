const CACHE_KEY = "opengit.update.last-check";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Update-check cache (OG-081). The version comparison and the download live in
 * `tauri-plugin-updater`; this only throttles the silent startup check so it
 * does not hit the network on every launch.
 */

/** Whether the cached check is still fresh (24h). */
export function cacheFresh(now: number = Date.now()): boolean {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored === null) {
      return false;
    }
    return now - Number(stored) < CACHE_TTL_MS;
  } catch {
    // Without storage every startup checks once.
    return false;
  }
}

/** Records a check, manual or automatic. */
export function stampCheck(now: number = Date.now()): void {
  try {
    localStorage.setItem(CACHE_KEY, String(now));
  } catch {
    // Storage is best-effort only.
  }
}
