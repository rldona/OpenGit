/** `origin/main` → `{ remote: "origin", branch: "main" }`; null si no hay upstream. */
export function splitUpstream(upstream: string | null): { remote: string; branch: string } | null {
  if (!upstream) {
    return null;
  }
  const slash = upstream.indexOf("/");
  if (slash <= 0 || slash === upstream.length - 1) {
    return null;
  }
  return { remote: upstream.slice(0, slash), branch: upstream.slice(slash + 1) };
}
