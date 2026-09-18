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
 * Fecha de un commit al estilo SourceTree: relativa cuando es reciente y
 * absoluta a partir de ahí.
 *
 * `now` se inyecta a propósito: sin eso los tests dependerían del reloj y
 * fallarían justo al cruzar la medianoche.
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

/** `Nombre <email>`, o solo el nombre si no hay email. */
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
 * Clasifica una ref decorada por `%D` para pintarla. Separado del componente
 * para poder probar el reparto de tipos sin montar el árbol de React.
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
  // `%D` da las remotas ya como `origin/rama`; una rama local no lleva barra.
  if (value.includes("/")) {
    return { kind: "remote", label: value };
  }
  return { kind: "branch", label: value };
}
