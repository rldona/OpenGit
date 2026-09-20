import { useEffect } from "react";
import { confirmDestructive } from "../lib/bridge/dialog";
import { LAYOUT_KEYS } from "../lib/layout";
import { useRepoStore } from "../lib/stores/repo";
import { useDiffStore } from "../lib/stores/diff";
import { useUiStore } from "../lib/stores/ui";
import { DiffFilesPanel } from "./DiffFilesPanel";
import { DiffPatchPanel } from "./DiffPatchPanel";
import { SplitPane } from "./SplitPane";

export function DiffView() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const storeRoot = useDiffStore((state) => state.root);
  const target = useDiffStore((state) => state.target);
  const selected = useDiffStore((state) => state.selected);
  const mode = useDiffStore((state) => state.mode);
  const reversed = useDiffStore((state) => state.reversed);
  const loading = useDiffStore((state) => state.loading);
  const selectedLines = useDiffStore((state) => state.selectedLines);
  const openWorktree = useDiffStore((state) => state.openWorktree);
  const setMode = useDiffStore((state) => state.setMode);
  const toggleReverse = useDiffStore((state) => state.toggleReverse);
  const applySelection = useDiffStore((state) => state.applySelection);
  const discardSelection = useDiffStore((state) => state.discardSelection);
  const fileTree = useUiStore((state) => state.fileTree);
  const setFileTree = useUiStore((state) => state.setFileTree);

  useEffect(() => {
    // Solo carga el working tree si no hay un objetivo previo (p. ej. un commit).
    if (root && (storeRoot !== root || target === null)) {
      void openWorktree(root);
    }
  }, [root, storeRoot, target, openWorktree]);

  const label = target?.kind === "commit" ? `commit ${target.rev.slice(0, 7)}` : "Working tree";
  // Con el parche invertido los índices de hunk/línea no corresponden al diff
  // que el backend vuelve a leer, así que no se ofrecen acciones de parche.
  const patchActions = target?.kind === "worktree" && !reversed;

  const confirmDiscard = async (selection: Parameters<typeof discardSelection>[0]) => {
    if (await confirmDestructive("Discard the selected changes? This cannot be undone.")) {
      await discardSelection(selection);
    }
  };

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
        <div className="diff-modes">
          <button
            type="button"
            className={fileTree ? "" : "active"}
            onClick={() => setFileTree(false)}
          >
            List
          </button>
          <button
            type="button"
            className={fileTree ? "active" : ""}
            onClick={() => setFileTree(true)}
          >
            Tree
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
        {patchActions && selected && !selected.untracked && (
          <button
            type="button"
            onClick={() => void applySelection({ kind: "file" })}
            disabled={loading}
          >
            {selected.staged ? "Unstage file" : "Stage file"}
          </button>
        )}
        {patchActions && selected && selectedLines.length > 0 && (
          <button
            type="button"
            onClick={() => void applySelection({ kind: "lines", indices: selectedLines })}
            disabled={loading}
          >
            {selected.staged ? "Unstage" : "Stage"} {selectedLines.length} line(s)
          </button>
        )}
        {patchActions &&
          selected &&
          !selected.untracked &&
          !selected.staged &&
          selectedLines.length > 0 && (
            <button
              type="button"
              className="danger"
              onClick={() => void confirmDiscard({ kind: "lines", indices: selectedLines })}
              disabled={loading}
            >
              Discard {selectedLines.length} line(s)
            </button>
          )}
        {loading && <span className="muted">Loading…</span>}
      </div>

      <SplitPane
        className="diff-body"
        direction="horizontal"
        side="start"
        storageKey={LAYOUT_KEYS.diffFiles}
        defaultSize={280}
        min={180}
        max={520}
        label="Resize file list"
      >
        <DiffFilesPanel />
        <DiffPatchPanel />
      </SplitPane>
    </div>
  );
}
