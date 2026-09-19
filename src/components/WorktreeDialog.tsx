import { useEffect, useState } from "react";
import { formatGitError } from "../lib/bridge/errors";
import { pickDirectory } from "../lib/bridge/dialog";
import { worktreeAdd } from "../lib/bridge/repo";
import { useExtrasStore } from "../lib/stores/extras";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";

/** Creates a worktree on a new or existing branch (OG-058). */
export function WorktreeDialog({ onClose }: { onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const [path, setPath] = useState("");
  const [branch, setBranch] = useState("");
  const [create, setCreate] = useState(true);
  const [startPoint, setStartPoint] = useState("HEAD");
  const [busy, setBusy] = useState(false);
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

  const browse = async () => {
    const picked = await pickDirectory();
    if (picked) {
      setPath(picked);
    }
  };

  const submit = async () => {
    if (!root || busy) {
      return;
    }
    const nextPath = path.trim();
    const nextBranch = branch.trim();
    if (nextPath === "" || nextBranch === "") {
      setError("Worktree folder and branch are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await worktreeAdd(
        root,
        nextPath,
        nextBranch,
        create,
        create ? startPoint.trim() || "HEAD" : null,
      );
      await useExtrasStore.getState().refresh(root);
      useUiStore.getState().appendOutput(`Worktree ${nextBranch} at ${nextPath}`);
      onClose();
    } catch (err) {
      setError(formatGitError(err));
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label="New worktree">
        <h2 className="remote-dialog-title">New worktree</h2>

        <label className="remote-field">
          <span>Folder:</span>
          <input
            aria-label="Worktree folder"
            value={path}
            autoFocus
            onChange={(event) => setPath(event.target.value)}
          />
          <button type="button" className="remote-refresh" onClick={() => void browse()}>
            Browse…
          </button>
        </label>

        <label className="remote-field">
          <span>Branch:</span>
          <input
            aria-label="Worktree branch"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
        </label>

        <fieldset className="remote-options">
          <legend>Branch</legend>
          <label>
            <input
              type="radio"
              name="worktree-branch-mode"
              checked={create}
              onChange={() => setCreate(true)}
            />
            Create a new branch
          </label>
          <label>
            <input
              type="radio"
              name="worktree-branch-mode"
              checked={!create}
              onChange={() => setCreate(false)}
            />
            Use an existing branch
          </label>
        </fieldset>

        {create && (
          <label className="remote-field">
            <span>Start point:</span>
            <input
              aria-label="Worktree start point"
              value={startPoint}
              onChange={(event) => setStartPoint(event.target.value)}
            />
          </label>
        )}

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
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
