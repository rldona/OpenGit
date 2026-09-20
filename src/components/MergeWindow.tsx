import { useEffect, useMemo, useRef, useState } from "react";
import type { MergeOptions } from "../lib/bridge/types";
import { useMergeBranch } from "../lib/hooks/useMergeBranch";
import { DEFAULT_MERGE_OPTIONS } from "../lib/merge";
import { useDiffStore } from "../lib/stores/diff";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { MergeFromLogPanel } from "./MergeFromLogPanel";

type Tab = "log" | "fetched";

function MergeOptionsFields({
  options,
  onChange,
}: {
  options: MergeOptions;
  onChange: (options: MergeOptions) => void;
}) {
  // `--squash` does not commit either: the commit flags stop making sense.
  const commitFlagsDisabled = options.rebase || options.squash;
  return (
    <>
      <fieldset className="remote-options merge-options">
        <legend>Options</legend>
        <label>
          <input
            type="checkbox"
            checked={!options.noCommit}
            disabled={commitFlagsDisabled}
            onChange={(event) => onChange({ ...options, noCommit: !event.target.checked })}
          />
          Commit merge immediately (if no conflicts)
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.includeMessages}
            disabled={commitFlagsDisabled}
            onChange={(event) => onChange({ ...options, includeMessages: event.target.checked })}
          />
          Include messages from commits being merged in merge commit
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.noFf}
            disabled={commitFlagsDisabled}
            onChange={(event) => onChange({ ...options, noFf: event.target.checked })}
          />
          Create a commit even if merge resolved via fast-forward
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.squash}
            disabled={options.rebase}
            onChange={(event) => onChange({ ...options, squash: event.target.checked })}
          />
          Squash changes (stage them without committing)
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.rebase}
            onChange={(event) => onChange({ ...options, rebase: event.target.checked })}
          />
          Rebase instead of merge (WARNING: make sure you haven&apos;t pushed your changes)
        </label>
      </fieldset>

      <fieldset className="remote-options merge-options">
        <legend>Advanced</legend>
        <div className="remote-field">
          <span>Conflict resolution:</span>
          <select
            aria-label="Merge strategy"
            value={options.strategy ?? ""}
            disabled={options.rebase}
            onChange={(event) =>
              onChange({
                ...options,
                strategy: (event.target.value || null) as MergeOptions["strategy"],
              })
            }
          >
            <option value="">Default</option>
            <option value="ours">Prefer ours (current branch)</option>
            <option value="theirs">Prefer theirs (merged branch)</option>
          </select>
        </div>
        <p className="muted">
          -X ours/theirs only resolves content conflicts; rename/delete conflicts still need manual
          resolution.
        </p>
      </fieldset>
    </>
  );
}

/** Branch picker tab; it reports the selected branch to the window. */
function MergeFetchedPanel({ onPick }: { onPick: (rev: string) => void }) {
  const refs = useRefsStore((state) => state.refs);
  const current = useRefsStore((state) => state.current);
  const [rev, setRev] = useState("");

  const branches = useMemo(
    () =>
      refs
        .filter((ref) => ref.name.startsWith("refs/heads/"))
        .map((ref) => ref.name.slice("refs/heads/".length))
        .filter((name) => name !== current),
    [refs, current],
  );

  useEffect(() => {
    onPick(rev);
  }, [rev, onPick]);

  return (
    <div className="merge-tab-panel">
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
    </div>
  );
}

/**
 * SourceTree-style merge window (OG-063): a log picker with preview as the
 * default tab, the branch picker as the second one, and the merge options
 * shared at the bottom.
 */
export function MergeWindow({ onClose }: { onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const runMerge = useMergeBranch(root);
  const [tab, setTab] = useState<Tab>("log");
  const [options, setOptions] = useState<MergeOptions>(DEFAULT_MERGE_OPTIONS);
  const [pickedCommit, setPickedCommit] = useState<string | null>(null);
  const [pickedBranch, setPickedBranch] = useState("");
  const diffSnapshot = useRef(useDiffStore.getState());

  // The preview borrows the diff store; the view behind the modal must not
  // change, so its state is restored when the window closes.
  useEffect(() => {
    const snapshot = diffSnapshot.current;
    return () => useDiffStore.setState(snapshot);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const rev = tab === "log" ? pickedCommit : pickedBranch !== "" ? pickedBranch : null;
  const canSubmit = root !== null && rev !== null;

  const submit = async () => {
    if (rev === null) {
      return;
    }
    await runMerge(rev, options);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="merge-window" role="dialog" aria-modal="true" aria-label="Merge">
        <div className="merge-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`merge-tab${tab === "log" ? " active" : ""}`}
            aria-selected={tab === "log"}
            onClick={() => setTab("log")}
          >
            Merge From Log
          </button>
          <button
            type="button"
            role="tab"
            className={`merge-tab${tab === "fetched" ? " active" : ""}`}
            aria-selected={tab === "fetched"}
            onClick={() => setTab("fetched")}
          >
            Merge Fetched
          </button>
        </div>

        <div className="merge-tab-body">
          <div className={`merge-tab-slot${tab === "log" ? "" : " hidden"}`}>
            {root !== null && <MergeFromLogPanel root={root} onPick={setPickedCommit} />}
          </div>
          <div className={`merge-tab-slot${tab === "fetched" ? "" : " hidden"}`}>
            <MergeFetchedPanel onPick={setPickedBranch} />
          </div>
        </div>

        <MergeOptionsFields options={options} onChange={setOptions} />

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
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
