import { useEffect, useState } from "react";
import { formatGitError } from "../lib/bridge/errors";
import { submoduleAdd } from "../lib/bridge/repo";
import { useExtrasStore } from "../lib/stores/extras";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
import { useUiStore } from "../lib/stores/ui";

/** Registers and clones a new submodule from the Branches menu (OG-057). */
export function SubmoduleDialog({ onClose }: { onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const [url, setUrl] = useState("");
  const [path, setPath] = useState("");
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

  const submit = async () => {
    if (!root || busy) {
      return;
    }
    const nextUrl = url.trim();
    const nextPath = path.trim();
    if (nextUrl === "" || nextPath === "") {
      setError("Submodule URL and path are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const output = await submoduleAdd(root, nextUrl, nextPath);
      for (const line of output.split("\n")) {
        if (line.trim() !== "") {
          useUiStore.getState().appendOutput(line);
        }
      }
      await useExtrasStore.getState().refresh(root);
      await useStatusStore.getState().refresh(root);
      useUiStore.getState().appendOutput(`Submodule ${nextPath} added`);
      onClose();
    } catch (err) {
      setError(formatGitError(err));
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label="Add Submodule">
        <h2 className="remote-dialog-title">Add Submodule</h2>

        <label className="remote-field">
          <span>URL:</span>
          <input
            aria-label="Submodule URL"
            value={url}
            autoFocus
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>

        <label className="remote-field">
          <span>Path:</span>
          <input
            aria-label="Submodule path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
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
          <button type="button" className="primary" disabled={busy} onClick={() => void submit()}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
