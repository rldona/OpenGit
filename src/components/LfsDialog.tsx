import { useEffect, useState } from "react";
import { formatGitError } from "../lib/bridge/errors";
import { lfsTrack } from "../lib/bridge/repo";
import { useExtrasStore } from "../lib/stores/extras";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";

/** Tracks a pattern or migrates files to Git LFS (OG-097). */
export function LfsDialog({ mode, onClose }: { mode: "track" | "migrate"; onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const [pattern, setPattern] = useState("");
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
    const value = pattern.trim();
    if (value === "") {
      setError("A pattern is required");
      return;
    }
    if (mode === "migrate") {
      // The job opens its own progress window; the warning above is the confirmation.
      void useRemoteStore.getState().start(root, { kind: "lfs_migrate", include: value });
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await lfsTrack(root, value);
      await useExtrasStore.getState().refresh(root);
      useUiStore.getState().appendOutput(`Tracking ${value} with Git LFS`);
      onClose();
    } catch (err) {
      setError(formatGitError(err));
      setBusy(false);
    }
  };

  const title = mode === "track" ? "Track pattern with Git LFS" : "Migrate files to Git LFS";
  const label = mode === "track" ? "Pattern:" : "Include pattern:";

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="remote-dialog-title">{title}</h2>

        {mode === "migrate" && (
          <p className="remote-dialog-subtitle">
            This rewrites history: every matching file becomes an LFS pointer in the rewritten
            commits. Push a backup branch before continuing.
          </p>
        )}

        <label className="remote-field">
          <span>{label}</span>
          <input
            aria-label={label}
            value={pattern}
            autoFocus
            placeholder="*.psd"
            onChange={(event) => setPattern(event.target.value)}
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
            className={mode === "migrate" ? "danger" : "primary"}
            disabled={busy}
            onClick={() => void submit()}
          >
            {mode === "track" ? "Track" : "Migrate"}
          </button>
        </div>
      </div>
    </div>
  );
}
