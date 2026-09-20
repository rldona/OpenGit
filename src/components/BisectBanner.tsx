import { useEffect } from "react";
import { useBisectStore } from "../lib/stores/bisect";
import { useRepoStore } from "../lib/stores/repo";

/**
 * Bisect banner (OG-090): while a bisect is in progress it shows the current
 * candidate and how many commits are left, with the good/bad/skip/reset actions.
 */
export function BisectBanner() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const state = useBisectStore((store) => store.state);
  const mark = useBisectStore((store) => store.mark);
  const reset = useBisectStore((store) => store.reset);

  useEffect(() => {
    if (root) {
      void useBisectStore.getState().load(root);
    }
  }, [root]);

  if (!root || !state.active) {
    return null;
  }

  const remaining = state.remaining === null ? "" : ` · ${state.remaining} left`;

  return (
    <div className="op-banner" role="status">
      <span>
        Bisecting {state.current?.slice(0, 7) ?? ""}
        {remaining}
      </span>
      <div className="op-banner-actions">
        <button type="button" onClick={() => void mark(root, "good")}>
          Good
        </button>
        <button type="button" onClick={() => void mark(root, "bad")}>
          Bad
        </button>
        <button type="button" onClick={() => void mark(root, "skip")}>
          Skip
        </button>
        <button type="button" onClick={() => void reset(root)}>
          Reset
        </button>
      </div>
    </div>
  );
}
