import { confirmDestructive } from "../lib/bridge/dialog";
import { parseLfsPointerPatch } from "../lib/lfs";
import { isImagePath } from "../lib/images";
import { useDiffStore } from "../lib/stores/diff";
import { DiffEditor } from "./DiffEditor";
import { ImageDiffPanel } from "./ImageDiffPanel";
import { PatchView } from "./PatchView";

/**
 * Patch panel of the selected file. Staging actions are only offered on the
 * non-reversed working tree: on a commit the diff is read-only.
 */
export function DiffPatchPanel() {
  const target = useDiffStore((state) => state.target);
  const selected = useDiffStore((state) => state.selected);
  const patch = useDiffStore((state) => state.patch);
  const binary = useDiffStore((state) => state.binary);
  const mode = useDiffStore((state) => state.mode);
  const reversed = useDiffStore((state) => state.reversed);
  const error = useDiffStore((state) => state.error);
  const selectedLines = useDiffStore((state) => state.selectedLines);
  const toggleLine = useDiffStore((state) => state.toggleLine);
  const applySelection = useDiffStore((state) => state.applySelection);
  const discardSelection = useDiffStore((state) => state.discardSelection);

  const patchActions = target?.kind === "worktree" && !reversed;
  const pointer = selected && !selected.untracked && !binary ? parseLfsPointerPatch(patch) : null;
  const imagePreview = selected && !selected.untracked && binary && isImagePath(selected.path);

  const confirmDiscard = async (selection: Parameters<typeof discardSelection>[0]) => {
    if (await confirmDestructive("Discard the selected changes? This cannot be undone.")) {
      await discardSelection(selection);
    }
  };

  return (
    <div className="diff-pane">
      {/* Header with the file path, like SourceTree: it replaces the
          `diff --git`/`index`/`---`/`+++` lines that are no longer rendered. */}
      {selected && (
        <div className="diff-pane-head" title={selected.path}>
          <span className="diff-pane-path">{selected.path}</span>
          {selected.orig_path && (
            <span className="diff-pane-orig muted">← {selected.orig_path}</span>
          )}
          {!selected.untracked && (
            <span className="diff-pane-counts">
              <span className="added">+{selected.added ?? 0}</span>
              <span className="deleted">-{selected.deleted ?? 0}</span>
            </span>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {pointer && (
        <p className="lfs-warning">
          Git LFS pointer (oid {pointer.oid.slice(0, 12)}…, {pointer.size} bytes): the real content
          is not available locally.
        </p>
      )}
      {!selected && !error && <p className="muted status-empty">No file selected</p>}
      {selected?.untracked && (
        <p className="muted status-empty">
          Untracked file: no diff yet. Stage it to see the content.
        </p>
      )}
      {imagePreview && <ImageDiffPanel />}
      {selected && !selected.untracked && binary && !imagePreview && (
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
  );
}
