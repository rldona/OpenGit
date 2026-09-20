import { useEffect, useMemo, useState } from "react";
import { useMergeBranch } from "../lib/hooks/useMergeBranch";
import { useRepoStore } from "../lib/stores/repo";
import { useRefsStore } from "../lib/stores/refs";

/** Merge dialog, sibling of the Pull one: branch to merge, target and --no-ff. */
export function MergeDialog({ onClose }: { onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const refs = useRefsStore((state) => state.refs);
  const current = useRefsStore((state) => state.current);
  const runMerge = useMergeBranch(root);
  const [rev, setRev] = useState("");
  const [noFf, setNoFf] = useState(false);

  const branches = useMemo(
    () =>
      refs
        .filter((ref) => ref.name.startsWith("refs/heads/"))
        .map((ref) => ref.name.slice("refs/heads/".length))
        .filter((name) => name !== current),
    [refs, current],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const canSubmit = root !== null && rev !== "" && current !== null;

  const submit = async () => {
    if (!canSubmit) {
      return;
    }
    await runMerge(rev, noFf);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label="Merge">
        <h2 className="remote-dialog-title">Merge</h2>

        <div className="remote-field">
          <span>Merge branch:</span>
          <select aria-label="Merge branch" value={rev} onChange={(e) => setRev(e.target.value)}>
            <option value="">Select a branch</option>
            {branches.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <p className="remote-field">
          <span>Into current branch:</span>
          <span className="remote-value">{current ?? "detached HEAD"}</span>
        </p>

        <fieldset className="remote-options">
          <legend>Options</legend>
          <label>
            <input
              type="checkbox"
              checked={noFf}
              onChange={(event) => setNoFf(event.target.checked)}
            />
            Create a merge commit even if fast-forward is possible
          </label>
        </fieldset>

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
            Merge
          </button>
        </div>
      </div>
    </div>
  );
}
