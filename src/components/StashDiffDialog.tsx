import { DiffEditor } from "./DiffEditor";
import { useStashStore } from "../lib/stores/stash";

export function StashDiffDialog() {
  const reference = useStashStore((state) => state.diffReference);
  const patch = useStashStore((state) => state.diffPatch);
  const loading = useStashStore((state) => state.diffLoading);
  const error = useStashStore((state) => state.diffError);
  const closeDiff = useStashStore((state) => state.closeDiff);

  if (!reference) {
    return null;
  }

  return (
    <div className="stash-diff-overlay">
      <div
        className="stash-diff-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Diff of ${reference}`}
      >
        <header>
          <h2>Stash diff · {reference}</h2>
          <button type="button" aria-label="Close" onClick={closeDiff}>
            ×
          </button>
        </header>
        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}
        {loading && <p className="muted">Loading…</p>}
        {!loading && !error && patch.trim() === "" && (
          <p className="muted">No changes in this stash</p>
        )}
        {!loading && !error && patch.trim() !== "" && (
          <div className="stash-diff-body">
            <DiffEditor patch={patch} fileName={reference} mode="unified" />
          </div>
        )}
      </div>
    </div>
  );
}
