import type { JobKind } from "../bridge/types";

/** Título de la ventana de progreso, al estilo SourceTree. */
export function describeRemoteJob(kind: JobKind): string {
  switch (kind.kind) {
    case "fetch":
      return kind.remote ? `Fetching from ${kind.remote}` : "Fetching all remotes";
    case "pull": {
      const from = kind.remote ?? "upstream";
      return kind.branch
        ? `Pulling Branch "${kind.branch}" From "${from}"`
        : `Pulling From "${from}"`;
    }
    case "push":
      return kind.remote ? `Pushing to ${kind.remote}` : "Pushing";
    case "push_tag":
      return `Pushing tag ${kind.tag}`;
  }
}
