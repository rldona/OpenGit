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
  const options = useDiffStore((state) => state.options);
  const toggleOption = useDiffStore((state) => state.toggleOption);
  const applySelection = useDiffStore((state) => state.applySelection);
  const discardSelection = useDiffStore((state) => state.discardSelection);
  const fileTree = useUiStore((state) => state.fileTree);
  const setFileTree = useUiStore((state) => state.setFileTree);

  useEffect(() => {
    // Only loads the working tree if there is no previous target (e.g. a commit).
    if (root && (storeRoot !== root || target === null)) {
      void openWorktree(root);
    }
  }, [root, storeRoot, target, openWorktree]);

  const label =
    target?.kind === "commit"
      ? `commit ${target.rev.slice(0, 7)}`
      : target?.kind === "compare"
        ? `${target.base.slice(0, 7)}..${target.rev.slice(0, 7)}`
        : "Working tree";
  // With the patch reversed the hunk/line indices do not match the diff the
  // backend re-reads, so no patch actions are offered.
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
        {target?.kind === "compare" && root && (
          <button type="button" onClick={() => void openWorktree(root)}>
            Exit comparison
          </button>
        )}
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
        <div className="diff-modes" role="group" aria-label="Diff options">
          <button
            type="button"
            className={options.ignore_all_space ? "active" : ""}
            aria-pressed={options.ignore_all_space}
            disabled={!selected || selected.untracked}
            onClick={() => void toggleOption("ignore_all_space")}
          >
            Ignore whitespace
          </button>
          <button
            type="button"
            className={options.ignore_blank_lines ? "active" : ""}
            aria-pressed={options.ignore_blank_lines}
            disabled={!selected || selected.untracked}
            onClick={() => void toggleOption("ignore_blank_lines")}
          >
            Ignore blank lines
          </button>
          <button
            type="button"
            className={options.word_diff ? "active" : ""}
            aria-pressed={options.word_diff}
            disabled={!selected || selected.untracked}
            onClick={() => void toggleOption("word_diff")}
          >
            Word diff
          </button>
        </div>
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
