import { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { useBisectStore } from "../lib/stores/bisect";
import { useRepoStore } from "../lib/stores/repo";

/**
 * Start-bisect dialog (OG-090): the bad commit (defaults to HEAD) and one or
 * more known-good commits, separated by spaces or commas.
 */
export function BisectStartDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const start = useBisectStore((state) => state.start);
  const [bad, setBad] = useState("HEAD");
  const [good, setGood] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = () => {
    if (root === null) {
      return;
    }
    const goods = good
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter((value) => value !== "");
    if (goods.length === 0) {
      setError(t("bisect.required"));
      return;
    }
    void start(root, bad.trim() === "" ? null : bad.trim(), goods);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div
        className="remote-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("bisect.dialogAria")}
      >
        <h2 className="remote-dialog-title">{t("bisect.title")}</h2>

        <label className="remote-field">
          <span>{t("bisect.badCommit")}</span>
          <input
            aria-label={t("bisect.badCommitAria")}
            value={bad}
            autoFocus
            onChange={(event) => setBad(event.target.value)}
          />
        </label>

        <label className="remote-field">
          <span>{t("bisect.goodCommits")}</span>
          <input
            aria-label={t("bisect.goodCommitsAria")}
            value={good}
            placeholder={t("bisect.goodPlaceholder")}
            onChange={(event) => setGood(event.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}

        <div className="remote-dialog-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="button" className="primary" onClick={submit}>
            {t("bisect.start")}
          </button>
        </div>
      </div>
    </div>
  );
}
