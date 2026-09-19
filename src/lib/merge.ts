import type { MergeOptions } from "./bridge/types";

/** Merge window defaults: merge and commit right away, fast-forward allowed. */
export const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  noFf: false,
  noCommit: false,
  includeMessages: false,
  rebase: false,
};
