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
