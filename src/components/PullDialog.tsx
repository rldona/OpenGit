import { useEffect, useMemo, useState } from "react";
import { splitUpstream } from "../lib/remote/upstream";
import { useExtrasStore } from "../lib/stores/extras";
import { useRefsStore } from "../lib/stores/refs";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";

/**
 * Pull options dialog, SourceTree style: remote, remote branch,
 * local target branch and the options that map to git flags.
 */
export function PullDialog({ onClose }: { onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const remotes = useExtrasStore((state) => state.remotes);
  const refs = useRefsStore((state) => state.refs);
  const current = useRefsStore((state) => state.current);
  const upstream = useRefsStore((state) => state.upstream);
  const refreshRefs = useRefsStore((state) => state.refresh);
  const start = useRemoteStore((state) => state.start);

  const remoteNames = useMemo(() => remotes.map((remote) => remote.name), [remotes]);
  const upstreamParts = useMemo(() => splitUpstream(upstream), [upstream]);

  const defaultRemote = useMemo(() => {
    if (upstreamParts && remoteNames.includes(upstreamParts.remote)) {
      return upstreamParts.remote;
    }
    if (remoteNames.includes("origin")) {
      return "origin";
    }
    return remoteNames[0] ?? "";
  }, [remoteNames, upstreamParts]);

  const [remote, setRemote] = useState(defaultRemote);
  const [branch, setBranch] = useState(upstreamParts?.branch ?? "");
  const [commitImmediately, setCommitImmediately] = useState(true);
  const [includeMessages, setIncludeMessages] = useState(false);
  const [noFf, setNoFf] = useState(false);
  const [rebase, setRebase] = useState(false);

  const branches = useMemo(
    () =>
      refs
        .filter(
          (ref) => ref.name.startsWith(`refs/remotes/${remote}/`) && !ref.name.endsWith("/HEAD"),
        )
        .map((ref) => ref.name.slice(`refs/remotes/${remote}/`.length)),
    [refs, remote],
  );

  // When switching remotes, or refreshing their branches, the chosen branch
  // stops existing: we fall back to the upstream one, then main, then the first.
  useEffect(() => {
    setBranch((chosen) => {
      if (branches.includes(chosen)) {
        return chosen;
      }
      if (upstreamParts && branches.includes(upstreamParts.branch)) {
        return upstreamParts.branch;
      }
      if (branches.includes("main")) {
        return "main";
      }
      return branches[0] ?? "";
    });
  }, [branches, upstreamParts]);

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
  const canSubmit = root !== null && remote !== "" && (branch !== "" || branches.length === 0);

  const submit = () => {
    if (!root || !canSubmit) {
      return;
    }
    void start(root, {
      kind: "pull",
      remote,
      branch: branch || null,
      rebase,
      no_ff: !rebase && noFf,
      no_commit: !rebase && !commitImmediately,
      include_messages: !rebase && includeMessages,
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label="Pull">
        <h2 className="remote-dialog-title">Pull</h2>

        <label className="remote-field">
          <span>Pull from repository:</span>
          <select
            aria-label="Pull from repository"
            value={remote}
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
        {selectedUrl && <p className="remote-url">{selectedUrl}</p>}

        <div className="remote-field">
          <span>Remote branch to pull:</span>
          <select
            aria-label="Remote branch to pull"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          >
            {branches.length === 0 && <option value="">Select a branch</option>}
            {branches.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="remote-refresh"
            disabled={!root}
            onClick={() => root && void refreshRefs(root)}
          >
            Refresh
          </button>
        </div>

        <p className="remote-field">
          <span>Pull into local branch:</span>
          <span className="remote-value">{current ?? "detached HEAD"}</span>
        </p>

        <fieldset className="remote-options">
          <legend>Options</legend>
          <label>
            <input
              type="checkbox"
              checked={commitImmediately}
              onChange={(event) => setCommitImmediately(event.target.checked)}
            />
            Commit merged changes immediately
          </label>
          <label>
            <input
              type="checkbox"
              disabled={rebase}
              checked={includeMessages}
              onChange={(event) => setIncludeMessages(event.target.checked)}
            />
            Include messages from commits being merged in merge commit
          </label>
          <label>
            <input
              type="checkbox"
              disabled={rebase}
              checked={noFf}
              onChange={(event) => setNoFf(event.target.checked)}
            />
            Create new commit even if fast-forward merge
          </label>
          <label>
            <input
              type="checkbox"
              checked={rebase}
              onChange={(event) => setRebase(event.target.checked)}
            />
            Rebase instead of merge (WARNING: make sure you haven't pushed your changes)
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
