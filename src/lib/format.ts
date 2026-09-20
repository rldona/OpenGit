const dateTime = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(timestamp: number): string {
  return dateTime.format(new Date(timestamp * 1000));
}

export function shortRefName(fullName: string): string {
  return fullName
    .replace(/^refs\/heads\//, "")
    .replace(/^refs\/remotes\//, "")
    .replace(/^refs\/tags\//, "");
}

export function parseTrack(track: string | null): { ahead: number; behind: number } | null {
  if (!track) {
    return null;
  }
  const ahead = /ahead (\d+)/.exec(track);
  const behind = /behind (\d+)/.exec(track);
  if (!ahead && !behind) {
    return null;
  }
  return {
    ahead: ahead ? Number.parseInt(ahead[1], 10) : 0,
    behind: behind ? Number.parseInt(behind[1], 10) : 0,
  };
}
