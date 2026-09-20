import type { JobKind } from "../bridge/types";
import { t } from "../i18n";

/** Progress window title, SourceTree style. */
export function describeRemoteJob(kind: JobKind): string {
  switch (kind.kind) {
    case "fetch":
      return kind.remote ? t("jobs.fetchingFrom", { remote: kind.remote }) : t("jobs.fetchingAll");
    case "pull": {
      const from = kind.remote ?? t("jobs.upstream");
      return kind.branch
        ? t("jobs.pullingBranchFrom", { branch: kind.branch, from })
        : t("jobs.pullingFrom", { from });
    }
    case "push":
      return kind.remote ? t("jobs.pushingTo", { remote: kind.remote }) : t("jobs.pushing");
    case "push_tag":
      return t("jobs.pushingTag", { tag: kind.tag });
    case "clone":
      return t("jobs.cloning", { url: kind.url });
    case "lfs_pull":
      return t("jobs.lfsPull");
    case "lfs_migrate":
      return t("jobs.lfsMigrate", { include: kind.include });
  }
}
