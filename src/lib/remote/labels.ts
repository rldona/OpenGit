import type { JobKind } from "../bridge/types";

/** Progress window title, SourceTree style. */
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
    case "clone":
      return `Cloning ${kind.url}`;
    case "lfs_pull":
      return "Downloading LFS objects";
    case "lfs_migrate":
      return `Migrating ${kind.include} to LFS`;
  }
}
