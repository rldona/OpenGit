import { useEffect } from "react";
import { hasActiveOperation, stagedEntries, useCommitStore } from "../lib/stores/commit";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";

const MAX_LISTED = 6;

export function CommitPanel() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const report = useStatusStore((state) => state.report);
  const message = useCommitStore((state) => state.message);
  const amend = useCommitStore((state) => state.amend);
  const opState = useCommitStore((state) => state.opState);
  const loading = useCommitStore((state) => state.loading);
  const error = useCommitStore((state) => state.error);
  const load = useCommitStore((state) => state.load);
  const setMessage = useCommitStore((state) => state.setMessage);
  const setAmend = useCommitStore((state) => state.setAmend);
  const submit = useCommitStore((state) => state.submit);

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  const staged = stagedEntries(report);
  const operationActive = hasActiveOperation(opState);

  return (
    <section className="commit-panel" aria-label="Commit">
      <div className="commit-staged">
        <h3>
          Staged <span className="count">{staged.length}</span>
        </h3>
        {staged.length === 0 ? (
          <p className="muted">Nothing staged</p>
        ) : (
          <ul>
            {staged.slice(0, MAX_LISTED).map((entry) => (
              <li key={entry.path} className="commit-file">
                {entry.path}
              </li>
            ))}
            {staged.length > MAX_LISTED && (
              <li className="muted">+{staged.length - MAX_LISTED} more</li>
            )}
          </ul>
        )}
      </div>

      <label className="commit-amend">
        <input
          type="checkbox"
          checked={amend}
          onChange={(event) => void setAmend(event.target.checked)}
        />
        Amend last commit
      </label>

      <textarea
        className="commit-message"
        aria-label="Commit message"
        placeholder="Commit message"
        rows={3}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />

      <div className="commit-footer">
        <span className="muted">{message.length} characters</span>
        <button
          type="button"
          onClick={() => void submit(staged.length)}
          disabled={loading || operationActive}
        >
          {amend ? "Amend" : "Commit"}
        </button>
      </div>

      {error && (
        <p role="alert" className="error-banner commit-error">
          {error}
        </p>
      )}
    </section>
  );
}
