import { useEffect, useState } from "react";
import { confirmDestructive } from "../lib/bridge/dialog";
import { copyText } from "../lib/clipboard";
import { LAYOUT_KEYS } from "../lib/layout";
import { parseLfsPointerPatch } from "../lib/lfs";
import { useRepoStore } from "../lib/stores/repo";
import { useDiffStore } from "../lib/stores/diff";
import { useUiStore } from "../lib/stores/ui";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { DiffEditor } from "./DiffEditor";
import { FileTree } from "./FileTree";
import { PatchView } from "./PatchView";
import { SplitPane } from "./SplitPane";

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
  const discardSelection = useDiffStore((state) => state.discardSelection);
  const fileTree = useUiStore((state) => state.fileTree);
  const setFileTree = useUiStore((state) => state.setFileTree);
  const fileMenu = useContextMenu();
  const [fileFilter, setFileFilter] = useState("");

  useEffect(() => {
    // Solo carga el working tree si no hay un objetivo previo (p. ej. un commit).
    if (root && (storeRoot !== root || target === null)) {
      void openWorktree(root);
    }
  }, [root, storeRoot, target, openWorktree]);

  const label = target?.kind === "commit" ? `commit ${target.rev.slice(0, 7)}` : "Working tree";
  const pointer = selected && !selected.untracked && !binary ? parseLfsPointerPatch(patch) : null;
  const needle = fileFilter.trim().toLowerCase();
  const visibleFiles =
    needle === ""
      ? files
      : files.filter(
          (entry) =>
            entry.path.toLowerCase().includes(needle) ||
            (entry.orig_path?.toLowerCase().includes(needle) ?? false),
        );
  // Con el parche invertido los índices de hunk/línea no corresponden al diff
  // que el backend vuelve a leer, así que no se ofrecen acciones de parche.
  const patchActions = target?.kind === "worktree" && !reversed;

  const confirmDiscard = async (selection: Parameters<typeof discardSelection>[0]) => {
    if (await confirmDestructive("Discard the selected changes? This cannot be undone.")) {
      await discardSelection(selection);
    }
  };

  const renderFileEntry = (entry: (typeof files)[number], displayPath = entry.path) => (
    <button
      type="button"
      className={`diff-file${selected?.key === entry.key ? " selected" : ""}`}
      onClick={() => void selectFile(entry)}
      onContextMenu={(event) =>
        fileMenu.open(event, [
          { label: "Select", onSelect: () => void selectFile(entry) },
          { label: "Copy path", onSelect: () => void copyText(entry.path) },
        ])
      }
    >
      <span className="diff-file-path" title={entry.path}>
        {entry.staged && <span className="diff-tag">index</span>}
        {displayPath}
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
  );

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
        <div className="diff-files">
          <div className="diff-files-search">
            <input
              type="search"
              aria-label="Filter files"
              placeholder="Filter…"
              value={fileFilter}
              onChange={(event) => setFileFilter(event.target.value)}
            />
          </div>
          {files.length === 0 && <p className="muted status-empty">No changes to show</p>}
          {files.length > 0 && visibleFiles.length === 0 && (
            <p className="muted status-empty">No files match</p>
          )}
          {fileTree ? (
            <FileTree
              items={visibleFiles}
              pathOf={(entry) => entry.path}
              renderFile={(entry, name) => renderFileEntry(entry, name)}
              renderDirExtra={(dir) => {
                const totals = dir.files.reduce(
                  (acc, entry) => ({
                    added: acc.added + (entry.added ?? 0),
                    deleted: acc.deleted + (entry.deleted ?? 0),
                  }),
                  { added: 0, deleted: 0 },
                );
                return (
                  <span className="diff-counts">
                    <span className="added">+{totals.added}</span>
                    <span className="deleted">-{totals.deleted}</span>
                  </span>
                );
              }}
            />
          ) : (
            visibleFiles.map((entry) => (
              <div key={entry.key} className="diff-file-row">
                {renderFileEntry(entry)}
              </div>
            ))
          )}
        </div>

        <div className="diff-pane">
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          {pointer && (
            <p className="lfs-warning">
              Git LFS pointer (oid {pointer.oid.slice(0, 12)}…, {pointer.size} bytes): the real
              content is not available locally.
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
              staging={patchActions}
              stagedSide={selected.staged}
              selectedLines={selectedLines}
              onToggleLine={toggleLine}
              onApply={(selection) => void applySelection(selection)}
              onDiscard={
                patchActions && !selected.staged
                  ? (selection) => void confirmDiscard(selection)
                  : undefined
              }
            />
          )}
          {selected && !selected.untracked && !binary && patch !== "" && mode === "side" && (
            <DiffEditor patch={patch} fileName={selected.path} mode={mode} />
          )}
        </div>
      </SplitPane>
      {fileMenu.menu}
    </div>
  );
}
