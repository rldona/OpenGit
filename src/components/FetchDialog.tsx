import { useEffect, useMemo, useState } from "react";
import { splitUpstream } from "../lib/remote/upstream";
import { useExtrasStore } from "../lib/stores/extras";
import { useRefsStore } from "../lib/stores/refs";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";

/** Diálogo de fetch, hermano del de pull: remoto (o todos) y prune. */
export function FetchDialog({ onClose }: { onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const remotes = useExtrasStore((state) => state.remotes);
  const upstream = useRefsStore((state) => state.upstream);
  const start = useRemoteStore((state) => state.start);

  const remoteNames = useMemo(() => remotes.map((remote) => remote.name), [remotes]);
  const defaultRemote = useMemo(() => {
    const upstreamParts = splitUpstream(upstream);
    if (upstreamParts && remoteNames.includes(upstreamParts.remote)) {
      return upstreamParts.remote;
    }
    if (remoteNames.includes("origin")) {
      return "origin";
    }
    return remoteNames[0] ?? "";
  }, [remoteNames, upstream]);

  const [remote, setRemote] = useState(defaultRemote);
  const [allRemotes, setAllRemotes] = useState(remoteNames.length === 0);
  const [prune, setPrune] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const selectedUrl = remotes.find((entry) => entry.name === remote)?.url ?? "";
  const canSubmit = root !== null && (allRemotes || remote !== "");

  const submit = () => {
    if (!root || !canSubmit) {
      return;
    }
    void start(root, { kind: "fetch", prune, remote: allRemotes ? null : remote });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label="Fetch">
        <h2 className="remote-dialog-title">Fetch</h2>

        <label className="remote-field">
          <span>Fetch from repository:</span>
          <select
            aria-label="Fetch from repository"
            value={remote}
            disabled={allRemotes}
            onChange={(event) => setRemote(event.target.value)}
          >
            {remoteNames.length === 0 && <option value="">No remotes</option>}
            {remoteNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {!allRemotes && selectedUrl && <p className="remote-url">{selectedUrl}</p>}

        <fieldset className="remote-options">
          <legend>Options</legend>
          <label>
            <input
              type="checkbox"
              checked={allRemotes}
              onChange={(event) => setAllRemotes(event.target.checked)}
            />
            Fetch all remotes
          </label>
          <label>
            <input
              type="checkbox"
              checked={prune}
              onChange={(event) => setPrune(event.target.checked)}
            />
            Prune tracking branches that no longer exist on the remote
          </label>
        </fieldset>

        <div className="remote-dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={!canSubmit} onClick={submit}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
