import { useEffect, useState } from "react";
import { formatGitError } from "../lib/bridge/errors";
import { remoteAdd, remoteRename, remoteSetUrl } from "../lib/bridge/repo";
import { useExtrasStore } from "../lib/stores/extras";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";

export type RemoteDialogMode = "add" | "edit";
/** Which part of the remote can be changed (OG-056). */
export type RemoteDialogField = "both" | "name" | "url";

type Props = {
  mode: RemoteDialogMode;
  field?: RemoteDialogField;
  remote?: { name: string; url: string } | null;
  onClose: () => void;
};

/**
 * Add/edit remote dialog (OG-056). Editing can be limited to the name (rename)
 * or the URL, so the sidebar can offer both actions without two forms.
 */
export function RemoteDialog({ mode, field = "both", remote = null, onClose }: Props) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const [name, setName] = useState(remote?.name ?? "");
  const [url, setUrl] = useState(remote?.url ?? "");
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

  const nameReadOnly = mode === "edit" && field === "url";
  const urlReadOnly = mode === "edit" && field === "name";
  const title =
    mode === "add" ? "New Remote" : field === "name" ? "Rename Remote" : "Edit Remote URL";

  const submit = async () => {
    if (!root || busy) {
      return;
    }
    const nextName = name.trim();
    const nextUrl = url.trim();
    if (!nameReadOnly && nextName === "") {
      setError("Remote name is required");
      return;
    }
    if (!urlReadOnly && nextUrl === "") {
      setError("Remote URL is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "add") {
        await remoteAdd(root, nextName, nextUrl);
      } else if (remote) {
        if (!nameReadOnly && nextName !== remote.name) {
          await remoteRename(root, remote.name, nextName);
        }
        if (!urlReadOnly && nextUrl !== remote.url) {
          await remoteSetUrl(root, nameReadOnly ? remote.name : nextName, nextUrl);
        }
      }
      await Promise.all([
        useExtrasStore.getState().refresh(root),
        useRefsStore.getState().refresh(root),
      ]);
      useUiStore
        .getState()
        .appendOutput(
          `Remote ${mode === "add" ? nextName : remote?.name} ${mode === "add" ? "added" : "updated"}`,
        );
      onClose();
    } catch (err) {
      setError(formatGitError(err));
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="remote-dialog-title">{title}</h2>

        <label className="remote-field">
          <span>Name:</span>
          <input
            aria-label="Remote name"
            value={name}
            readOnly={nameReadOnly}
            autoFocus={!nameReadOnly}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
        </label>

        <label className="remote-field">
          <span>URL:</span>
          <input
            aria-label="Remote URL"
            value={url}
            readOnly={urlReadOnly}
            autoFocus={nameReadOnly}
            onChange={(event) => setUrl(event.target.value)}
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
