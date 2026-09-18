import { useEffect } from "react";
import { useRepoStore } from "../lib/stores/repo";
import { useDiffStore } from "../lib/stores/diff";
import { DiffEditor } from "./DiffEditor";
import { PatchView } from "./PatchView";

export function DiffView() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const storeRoot = useDiffStore((state) => state.root);
  const target = useDiffStore((state) => state.target);
  const files = useDiffStore((state) => state.files);
  const selected = useDiffStore((state) => state.selected);
  const patch = useDiffStore((state) => state.patch);
  const binary = useDiffStore((state) => state.binary);
  const mode = useDiffStore((state) => state.mode);
  const reversed = useDiffStore((state) => state.reversed);
  const loading = useDiffStore((state) => state.loading);
  const error = useDiffStore((state) => state.error);
  const selectedLines = useDiffStore((state) => state.selectedLines);
  const openWorktree = useDiffStore((state) => state.openWorktree);
  const selectFile = useDiffStore((state) => state.selectFile);
  const setMode = useDiffStore((state) => state.setMode);
  const toggleReverse = useDiffStore((state) => state.toggleReverse);
  const toggleLine = useDiffStore((state) => state.toggleLine);
  const applySelection = useDiffStore((state) => state.applySelection);

  useEffect(() => {
    // Solo carga el working tree si no hay un objetivo previo (p. ej. un commit).
    if (root && (storeRoot !== root || target === null)) {
      void openWorktree(root);
    }
  }, [root, storeRoot, target, openWorktree]);

  const label = target?.kind === "commit" ? `commit ${target.rev.slice(0, 7)}` : "Working tree";

  return (
    <div className="diff-view">
      <div className="diff-toolbar">
        <span className="muted">{label}</span>
        <div className="diff-modes">
          <button
            type="button"
            className={mode === "unified" ? "active" : ""}
            onClick={() => setMode("unified")}
          >
            Unified
          </button>
          <button
            type="button"
            className={mode === "side" ? "active" : ""}
            onClick={() => setMode("side")}
          >
            Side by side
          </button>
        </div>
        <button
          type="button"
          onClick={() => void toggleReverse()}
          aria-pressed={reversed}
          disabled={!selected || selected.untracked}
        >
          Reverse
        </button>
        {target?.kind === "worktree" && selected && !selected.untracked && (
          <button
            type="button"
            onClick={() => void applySelection({ kind: "file" })}
            disabled={loading}
          >
            {selected.staged ? "Unstage file" : "Stage file"}
          </button>
        )}
        {target?.kind === "worktree" && selected && selectedLines.length > 0 && (
          <button
            type="button"
            onClick={() => void applySelection({ kind: "lines", indices: selectedLines })}
            disabled={loading}
          >
            {selected.staged ? "Unstage" : "Stage"} {selectedLines.length} line(s)
          </button>
        )}
        {loading && <span className="muted">Loading…</span>}
      </div>

      <div className="diff-body">
        <div className="diff-files">
          {files.length === 0 && <p className="muted status-empty">No changes to show</p>}
          {files.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`diff-file${selected?.key === entry.key ? " selected" : ""}`}
              onClick={() => void selectFile(entry)}
            >
              <span className="diff-file-path">
                {entry.staged && <span className="diff-tag">index</span>}
                {entry.path}
                {entry.orig_path && <span className="muted"> ← {entry.orig_path}</span>}
              </span>
              <span className="diff-counts">
                {entry.untracked ? (
                  <span className="added">new</span>
                ) : (
                  <>
                    <span className="added">+{entry.added ?? 0}</span>
                    <span className="deleted">-{entry.deleted ?? 0}</span>
                  </>
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="diff-pane">
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          {!selected && !error && <p className="muted status-empty">No file selected</p>}
          {selected?.untracked && (
            <p className="muted status-empty">
              Untracked file: no diff yet. Stage it to see the content.
            </p>
          )}
          {selected && !selected.untracked && binary && (
            <p className="muted status-empty">Binary file: no text diff available.</p>
          )}
          {selected && !selected.untracked && !binary && patch !== "" && mode === "unified" && (
            <PatchView
              patch={patch}
              staging={target?.kind === "worktree"}
              stagedSide={selected.staged}
              selectedLines={selectedLines}
              onToggleLine={toggleLine}
              onApply={(selection) => void applySelection(selection)}
            />
          )}
          {selected && !selected.untracked && !binary && patch !== "" && mode === "side" && (
            <DiffEditor patch={patch} fileName={selected.path} mode={mode} />
          )}
        </div>
      </div>
    </div>
  );
}
