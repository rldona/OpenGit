import { useEffect, useState } from "react";
import { pickFile } from "../lib/bridge/dialog";
import { formatGitError } from "../lib/bridge/errors";
import { applyPatch } from "../lib/bridge/patch";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";

/**
 * Apply patch dialog (OG-094): a mailbox patch (`git am`) or a plain diff
 * (`git apply`), optionally three-way, with the result in the Output panel.
 */
export function ApplyPatchDialog({ onClose }: { onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const [file, setFile] = useState("");
  const [mailbox, setMailbox] = useState(true);
  const [threeWay, setThreeWay] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const chooseFile = async () => {
    try {
      const picked = await pickFile("Choose a patch");
      if (picked !== null) {
        setFile(picked);
      }
    } catch (pickError) {
      setError(formatGitError(pickError));
    }
  };

  const submit = async () => {
    if (root === null || file === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const output = await applyPatch(root, file, mailbox, threeWay);
      const trimmed = output.trim();
      useUiStore.getState().appendOutput(trimmed === "" ? `Applied ${file}` : trimmed);
      onClose();
    } catch (applyError) {
      setError(formatGitError(applyError));
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label="Apply Patch">
        <h2 className="remote-dialog-title">Apply Patch</h2>

        <div className="remote-field">
          <span>Patch file:</span>
          <input aria-label="Patch file" readOnly value={file} autoFocus />
          <button type="button" onClick={() => void chooseFile()}>
            Choose…
          </button>
        </div>

        <fieldset className="remote-options">
          <legend>Options</legend>
          <label>
            <input
              type="checkbox"
              checked={mailbox}
              onChange={(event) => setMailbox(event.target.checked)}
            />
            Mailbox patch (git am, creates commits)
          </label>
          <label>
            <input
              type="checkbox"
              checked={threeWay}
              onChange={(event) => setThreeWay(event.target.checked)}
            />
            Three-way (--3way)
          </label>
        </fieldset>

        {error && (
          <p role="alert" className="error-banner">
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
            disabled={file === "" || busy}
            onClick={() => void submit()}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
