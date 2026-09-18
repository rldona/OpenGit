import { confirmDestructive } from "../lib/bridge/dialog";
import type { TodoAction } from "../lib/bridge/types";
import { useRebaseStore } from "../lib/stores/rebase";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";

const ACTIONS: TodoAction[] = ["pick", "reword", "squash", "fixup", "drop"];

export function RebaseView() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const base = useRebaseStore((state) => state.base);
  const rows = useRebaseStore((state) => state.rows);
  const loading = useRebaseStore((state) => state.loading);
  const error = useRebaseStore((state) => state.error);
  const setAction = useRebaseStore((state) => state.setAction);
  const move = useRebaseStore((state) => state.move);
  const setMessage = useRebaseStore((state) => state.setMessage);
  const run = useRebaseStore((state) => state.run);
  const reset = useRebaseStore((state) => state.reset);

  const setActiveView = useUiStore((state) => state.setActiveView);
  const missingMessage = rows.some((row) => row.action === "reword" && row.message.trim() === "");
  const dropping = rows.filter((row) => row.action === "drop").length;

  const confirmRun = async () => {
    if (!root || rows.length === 0) {
      return;
    }
    const warning = `Rewrite ${rows.length} commit(s)${dropping > 0 ? `, dropping ${dropping}` : ""}? This rewrites history.`;
    if (await confirmDestructive(warning)) {
      const ok = await run(root);
      if (ok) {
        setActiveView("history");
        reset();
      }
    }
  };

  return (
    <div className="rebase-view">
      <div className="rebase-toolbar">
        <span className="muted">
          Interactive rebase onto {base?.slice(0, 7) ?? "?"} · {rows.length} commit(s)
        </span>
        <div className="rebase-actions">
          <button
            type="button"
            className="detail-action"
            onClick={() => {
              reset();
              setActiveView("history");
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="detail-action danger"
            disabled={loading || rows.length === 0 || missingMessage}
            onClick={() => void confirmRun()}
          >
            Run rebase
          </button>
        </div>
      </div>

      <ol className="rebase-plan">
        {rows.map((row, index) => (
          <li key={row.hash} className={`rebase-row${row.action === "drop" ? " dropped" : ""}`}>
            <span className="rebase-order">{index + 1}</span>
            <select
              aria-label={`Action for ${row.short}`}
              value={row.action}
              onChange={(event) => setAction(index, event.target.value as TodoAction)}
            >
              {ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
            <span className="rebase-subject">{row.subject}</span>
            <span className="rebase-short mono">{row.short}</span>
            <span className="rebase-move">
              <button
                type="button"
                aria-label={`Move ${row.short} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${row.short} down`}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
            </span>
            {row.action === "reword" && (
              <input
                className="rebase-message"
                aria-label={`Reword message for ${row.short}`}
                placeholder="New message"
                value={row.message}
                onChange={(event) => setMessage(index, event.target.value)}
              />
            )}
          </li>
        ))}
      </ol>

      {rows.length === 0 && !loading && (
        <p className="muted status-empty">Nothing to rebase from this commit</p>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
    </div>
  );
}
