import { useEffect, useState } from "react";
import { useRepoStore } from "../lib/stores/repo";
import { useStashStore } from "../lib/stores/stash";

/** Saves the working tree changes as a stash, in a modal (OG-016). */
export function StashDialog({ onClose }: { onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const create = useStashStore((state) => state.create);
  const error = useStashStore((state) => state.error);
  const [message, setMessage] = useState("");
  const [untracked, setUntracked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = async () => {
    if (!root || busy) {
      return;
    }
    setBusy(true);
    const ok = await create(root, message.trim() === "" ? null : message.trim(), untracked);
    if (ok) {
      onClose();
      return;
    }
    setBusy(false);
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label="Stash Changes">
        <h2 className="remote-dialog-title">Stash Changes</h2>
        <p className="remote-dialog-subtitle">Save the working tree changes as a stash.</p>

        <label className="remote-field">
          <span>Message:</span>
          <input
            autoFocus
            aria-label="Stash message"
            placeholder="Message (optional)"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
        </label>

        <label className="refs-check">
          <input
            type="checkbox"
            checked={untracked}
            onChange={(event) => setUntracked(event.target.checked)}
          />
          Include untracked files
        </label>

        {error && (
          <p role="alert" className="refs-error">
            {error}
          </p>
        )}

        <div className="remote-dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={busy} onClick={() => void submit()}>
            Stash
          </button>
        </div>
      </div>
    </div>
  );
}
