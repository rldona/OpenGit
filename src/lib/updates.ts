import { openExternal } from "./bridge/opener";

const LATEST_URL = "https://api.github.com/repos/rldona/OpenGit/releases/latest";
const RELEASES_URL = "https://github.com/rldona/OpenGit/releases/latest";
const CACHE_KEY = "opengit.update.last-check";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

type Semver = [number, number, number];

/** Parses `1.2.3` with an optional leading `v`; `null` when not a version. */
export function parseVersion(tag: string): Semver | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(tag.trim());
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Whether `tag` names a newer release than the running `current` version. */
export function isNewer(current: string, tag: string): boolean {
  const from = parseVersion(current);
  const to = parseVersion(tag);
  if (!from || !to) {
    return false;
  }
  for (let index = 0; index < 3; index += 1) {
    if (to[index] !== from[index]) {
      return to[index] > from[index];
    }
  }
  return false;
}

/** Latest release tag (`vX.Y.Z`) or `null` when offline or failing. */
export async function fetchLatestTag(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(LATEST_URL, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("tag_name" in body)) {
      return null;
    }
    const tag = (body as { tag_name: unknown }).tag_name;
    return typeof tag === "string" ? tag : null;
  } catch {
    // Offline, rate-limited or timed out: the check stays silent.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

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

/** Opens the releases page (used by the update notice). */
export function openReleasesPage(): Promise<void> {
  return openExternal(RELEASES_URL);
}
