import { useEffect, useState } from "react";
import { useBisectStore } from "../lib/stores/bisect";
import { useRepoStore } from "../lib/stores/repo";

/**
 * Start-bisect dialog (OG-090): the bad commit (defaults to HEAD) and one or
 * more known-good commits, separated by spaces or commas.
 */
export function BisectStartDialog({ onClose }: { onClose: () => void }) {
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
      setError("Enter at least one known-good commit");
      return;
    }
    void start(root, bad.trim() === "" ? null : bad.trim(), goods);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label="Start Bisect">
        <h2 className="remote-dialog-title">Start Bisect</h2>

        <label className="remote-field">
          <span>Bad commit:</span>
          <input
            aria-label="Bad commit"
            value={bad}
            autoFocus
            onChange={(event) => setBad(event.target.value)}
          />
        </label>

        <label className="remote-field">
          <span>Good commit(s):</span>
          <input
            aria-label="Good commits"
            value={good}
            placeholder="HEAD~10 or a list"
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
            Cancel
          </button>
          <button type="button" className="primary" onClick={submit}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
