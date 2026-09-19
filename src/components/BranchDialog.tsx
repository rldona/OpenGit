import { useEffect, useState } from "react";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { WORKTREE_SELECTION, useLogStore } from "../lib/stores/log";

/** Creates a branch from the selected commit or HEAD, in a modal (OG-008/OG-041). */
export function BranchDialog({ onClose }: { onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const selected = useLogStore((state) => state.selected);
  const current = useRefsStore((state) => state.current);
  const create = useRefsStore((state) => state.create);
  const error = useRefsStore((state) => state.error);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const fromCommit = selected && selected !== WORKTREE_SELECTION ? selected : null;
  const startPoint = fromCommit ?? "HEAD";
  const baseLabel = fromCommit
    ? `commit ${fromCommit.slice(0, 7)}`
    : `HEAD${current ? ` (${current})` : ""}`;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const canSubmit = root !== null && name.trim() !== "" && !busy;

  const submit = async () => {
    if (!root || !canSubmit) {
      return;
    }
    setBusy(true);
    const ok = await create(root, name.trim(), startPoint);
    if (ok) {
      onClose();
      return;
    }
    setBusy(false);
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label="New Branch">
        <h2 className="remote-dialog-title">New Branch</h2>
        <p className="remote-dialog-subtitle">Create a new branch from {baseLabel}.</p>

        <label className="remote-field">
          <span>Name:</span>
          <input
            autoFocus
            aria-label="New branch name"
            placeholder="New branch name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
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
          <button
            type="button"
            className="primary"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
