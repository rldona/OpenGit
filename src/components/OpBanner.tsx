import { useEffect } from "react";
import { useCommitStore } from "../lib/stores/commit";
import { useRepoStore } from "../lib/stores/repo";

export function OpBanner() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const opState = useCommitStore((state) => state.opState);
  const load = useCommitStore((state) => state.load);
  const abort = useCommitStore((state) => state.abort);
  const continueOp = useCommitStore((state) => state.continueOp);

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  const operation = opState.rebase
    ? "rebase"
    : opState.merge
      ? "merge"
      : opState.cherry_pick
        ? "cherry-pick"
        : opState.revert
          ? "revert"
          : null;

  if (!operation || !root) {
    return null;
  }

  const progress =
    opState.rebase && opState.rebase_current !== null && opState.rebase_total !== null
      ? ` (${opState.rebase_current}/${opState.rebase_total})`
      : "";

  return (
    <div className="op-banner" role="status">
      <span>
        {operation}
        {progress} in progress
      </span>
      <div className="op-banner-actions">
        <button type="button" onClick={() => void abort(root)}>
          Abort
        </button>
        <button type="button" onClick={() => void continueOp(root)}>
          Continue
        </button>
      </div>
    </div>
  );
}
