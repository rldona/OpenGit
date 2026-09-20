import { useEffect, useState } from "react";
import { confirmDestructive } from "../lib/bridge/dialog";
import { formatDateTime } from "../lib/format";
import { useRepoStore } from "../lib/stores/repo";
import { useStashStore } from "../lib/stores/stash";
import { StashDiffDialog } from "./StashDiffDialog";

export function StashSidebar() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const stashes = useStashStore((state) => state.stashes);
  const error = useStashStore((state) => state.error);
  const load = useStashStore((state) => state.load);
  const create = useStashStore((state) => state.create);
  const apply = useStashStore((state) => state.apply);
  const pop = useStashStore((state) => state.pop);
  const drop = useStashStore((state) => state.drop);
  const openDiff = useStashStore((state) => state.openDiff);

  const [form, setForm] = useState(false);
  const [message, setMessage] = useState("");
  const [untracked, setUntracked] = useState(false);

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  const submit = async () => {
    if (!root) {
      return;
    }
    const ok = await create(root, message.trim() === "" ? null : message.trim(), untracked);
    if (ok) {
      setForm(false);
      setMessage("");
      setUntracked(false);
    }
  };

  const confirmDrop = async (reference: string) => {
    if (root && (await confirmDestructive(`Drop ${reference}? This cannot be undone.`))) {
      await drop(root, reference);
    }
  };

  return (
    <section className="sidebar-section">
      <h2>Stashes</h2>
      <div className="refs-toolbar">
        <button
          type="button"
          aria-label="New stash"
          title="New stash"
          onClick={() => setForm((value) => !value)}
        >
          +
        </button>
      </div>
      {form && (
        <div className="refs-inline refs-stash-form">
          <input
            autoFocus
            aria-label="Stash message"
            placeholder="Message (optional)"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <label className="refs-check">
            <input
              type="checkbox"
              checked={untracked}
              onChange={(event) => setUntracked(event.target.checked)}
            />
            Include untracked
          </label>
          <button type="button" onClick={() => void submit()}>
            Stash
          </button>
        </div>
      )}
      <ul className="refs-list">
        {stashes.map((stash) => (
          <li key={stash.hash} className="refs-item">
            <span className="refs-stash" title={stash.reference}>
              <span className="refs-stash-subject">{stash.subject}</span>
              <span className="refs-stash-date muted">{formatDateTime(stash.timestamp)}</span>
            </span>
            <span className="refs-actions">
              <button type="button" onClick={() => root && void openDiff(root, stash.reference)}>
                Diff
              </button>
              <button type="button" onClick={() => root && void apply(root, stash.reference)}>
                Apply
              </button>
              <button type="button" onClick={() => root && void pop(root, stash.reference)}>
                Pop
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => void confirmDrop(stash.reference)}
              >
                Drop
              </button>
            </span>
          </li>
        ))}
        {stashes.length === 0 && <li className="muted">No stashes</li>}
      </ul>
      {error && (
        <p role="alert" className="refs-error">
          {error}
        </p>
      )}
      <StashDiffDialog />
    </section>
  );
}
