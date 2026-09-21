import { useEffect } from "react";
import { useI18n } from "../lib/i18n";
import { useBisectStore } from "../lib/stores/bisect";
import { useRepoStore } from "../lib/stores/repo";

/**
 * Bisect banner (OG-090): while a bisect is in progress it shows the current
 * candidate and how many commits are left, with the good/bad/skip/reset actions.
 */
export function BisectBanner() {
  const { t } = useI18n();
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

  const remaining =
    state.remaining === null ? "" : t("bisect.remaining", { count: state.remaining });

  return (
    <div className="op-banner" role="status">
      <span>
        {t("bisect.bisecting", { hash: state.current?.slice(0, 7) ?? "" })}
        {remaining}
      </span>
      <div className="op-banner-actions">
        <button type="button" onClick={() => void mark(root, "good")}>
          {t("bisect.good")}
        </button>
        <button type="button" onClick={() => void mark(root, "bad")}>
          {t("bisect.bad")}
        </button>
        <button type="button" onClick={() => void mark(root, "skip")}>
          {t("bisect.skip")}
        </button>
        <button type="button" onClick={() => void reset(root)}>
          {t("bisect.reset")}
        </button>
      </div>
    </div>
  );
}
