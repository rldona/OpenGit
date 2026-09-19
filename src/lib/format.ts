const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const timeOnly = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateWithYear = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(timestamp: number): string {
  return dateTime.format(new Date(timestamp * 1000));
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Commit date SourceTree style: relative when recent and
 * absolute from there on.
 *
 * `now` is injected on purpose: without it the tests would depend on the
 * clock and would fail right when crossing midnight.
 */
export function formatCommitDate(timestamp: number, now: Date = new Date()): string {
  const date = new Date(timestamp * 1000);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days === 0) {
    return `Today at ${timeOnly.format(date)}`;
  }
  if (days === 1) {
    return `Yesterday at ${timeOnly.format(date)}`;
  }
  if (date.getFullYear() !== now.getFullYear()) {
    return dateWithYear.format(date);
  }
  return dateTime.format(date);
}

/** `Name <email>`, or just the name if there is no email. */
export function formatAuthor(name: string, email: string): string {
  return email === "" ? name : `${name} <${email}>`;
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

export type RefBadgeKind = "head" | "branch" | "remote" | "tag";

/**
 * Classifies a ref decorated by `%D` to paint it. Separated from the component
 * so the type mapping can be tested without mounting the React tree.
 */
export function classifyRef(value: string): { kind: RefBadgeKind; label: string } {
  if (value === "HEAD") {
    return { kind: "head", label: "HEAD" };
  }
  if (value.startsWith("HEAD -> ")) {
    return { kind: "head", label: value.slice("HEAD -> ".length) };
  }
  if (value.startsWith("tag: ")) {
    return { kind: "tag", label: value.slice("tag: ".length) };
  }
  // `%D` gives remotes already as `origin/branch`; a local branch has no slash.
  if (value.includes("/")) {
    return { kind: "remote", label: value };
  }
  return { kind: "branch", label: value };
}
