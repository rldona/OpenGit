import { useEffect, useRef, useState } from "react";
import { pickDirectory } from "../lib/bridge/dialog";
import { formatGitError } from "../lib/bridge/errors";
import { cloneFolderName } from "../lib/clone";
import { joinFolderPath } from "../lib/paths";
import { useRemoteStore } from "../lib/stores/remote";

/**
 * Clone dialog (OG-085): URL, destination and options. The clone runs as a
 * remote job, so the shared progress/error window takes over on OK and the
 * repository opens in a tab when it finishes.
 */
export function CloneDialog({ onClose }: { onClose: () => void }) {
  const start = useRemoteStore((state) => state.start);
  const running = useRemoteStore((state) => state.running);

  const [url, setUrl] = useState("");
  const [parent, setParent] = useState("");
  const [name, setName] = useState("");
  const [depth, setDepth] = useState("");
  const [branch, setBranch] = useState("");
  const [recurseSubmodules, setRecurseSubmodules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameTouched = useRef(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const canSubmit = url.trim() !== "" && parent !== "" && name.trim() !== "" && !running;

  const changeUrl = (value: string) => {
    setUrl(value);
    if (!nameTouched.current) {
      setName(cloneFolderName(value));
    }
  };

  const chooseParent = async () => {
    try {
      const picked = await pickDirectory();
      if (picked !== null) {
        setParent(picked);
      }
    } catch (pickError) {
      setError(formatGitError(pickError));
    }
  };

  const submit = () => {
    if (!canSubmit) {
      return;
    }
    const parsedDepth = depth.trim() === "" ? null : Number.parseInt(depth, 10);
    if (parsedDepth !== null && (!Number.isFinite(parsedDepth) || parsedDepth <= 0)) {
      setError("Depth must be a positive number");
      return;
    }
    void start(parent, {
      kind: "clone",
      url: url.trim(),
      destination: joinFolderPath(parent, name.trim()),
      depth: parsedDepth,
      branch: branch.trim() === "" ? null : branch.trim(),
      recurse_submodules: recurseSubmodules,
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label="Clone Repository">
        <h2 className="remote-dialog-title">Clone Repository</h2>

        <label className="remote-field">
          <span>Repository URL:</span>
          <input
            aria-label="Repository URL"
            value={url}
            autoFocus
            placeholder="https://github.com/user/repo.git"
            onChange={(event) => changeUrl(event.target.value)}
          />
        </label>

        <div className="remote-field">
          <span>Parent folder:</span>
          <input aria-label="Parent folder" readOnly value={parent} />
          <button type="button" onClick={() => void chooseParent()}>
            Choose…
          </button>
        </div>

        <label className="remote-field">
          <span>Folder name:</span>
          <input
            aria-label="Folder name"
            value={name}
            onChange={(event) => {
              nameTouched.current = true;
              setName(event.target.value);
            }}
          />
        </label>

        {parent !== "" && name.trim() !== "" && (
          <p className="remote-url">Clone into {joinFolderPath(parent, name.trim())}</p>
        )}

        <fieldset className="remote-options">
          <legend>Options</legend>
          <label className="remote-field">
            <span>Depth (optional):</span>
            <input
              aria-label="Depth"
              inputMode="numeric"
              value={depth}
              onChange={(event) => setDepth(event.target.value)}
            />
          </label>
          <label className="remote-field">
            <span>Branch (optional):</span>
            <input
              aria-label="Branch"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={recurseSubmodules}
              onChange={(event) => setRecurseSubmodules(event.target.checked)}
            />
            Clone submodules recursively
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
          <button type="button" className="primary" disabled={!canSubmit} onClick={submit}>
            Clone
          </button>
        </div>
      </div>
    </div>
  );
}
