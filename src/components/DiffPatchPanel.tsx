import { confirmDestructive } from "../lib/bridge/dialog";
import { useI18n } from "../lib/i18n";
import { parseLfsPointerPatch } from "../lib/lfs";
import { patchCounts, splitPatch } from "../lib/diff/patch";
import { isImagePath } from "../lib/images";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { useBlameStore } from "../lib/stores/blame";
import { useDiffStore } from "../lib/stores/diff";
import { useLogStore } from "../lib/stores/log";
import { useRepoStore } from "../lib/stores/repo";
import { DiffEditor } from "./DiffEditor";
import { ImageDiffPanel } from "./ImageDiffPanel";
import { PatchView } from "./PatchView";

/**
 * Patch panel of the selected file. Staging actions are only offered on the
 * non-reversed working tree: on a commit the diff is read-only.
 */
export function DiffPatchPanel() {
  const { t } = useI18n();
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
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const showFileHistory = useLogStore((state) => state.showFileHistory);
  const openBlame = useBlameStore((state) => state.open);
  const paneMenu = useContextMenu();

  const patchActions = target?.kind === "worktree" && !reversed;
  // Untracked files render a read-only new-file preview (OG-071): no staging
  // or discard actions, no blame. Images preview too, with only the after
  // side from disk (OG-075); the backend already resolves untracked sides.
  const previewOnly = selected?.untracked === true;
  const pointer = selected && !previewOnly && !binary ? parseLfsPointerPatch(patch) : null;
  const imagePreview = selected && binary && isImagePath(selected.path);
  const untrackedEmpty = previewOnly && !binary && patch !== "" && splitPatch(patch) === null;
  const untrackedCounts =
    previewOnly && !binary && patch !== "" && !untrackedEmpty ? patchCounts(patch) : null;

  const confirmDiscard = async (selection: Parameters<typeof discardSelection>[0]) => {
    if (await confirmDestructive(t("diff.discardConfirm"))) {
      await discardSelection(selection);
    }
  };

  return (
    <div
      className="diff-pane"
      onContextMenu={(event) =>
        paneMenu.open(event, [
          {
            label: t("diff.files.showHistory"),
            disabled: !selected,
            onSelect: () => root && selected && void showFileHistory(root, selected.path),
          },
          {
            label: t("diff.files.blame"),
            disabled: !selected || selected.untracked || binary,
            onSelect: () => root && selected && void openBlame(root, selected.path),
          },
        ])
      }
    >
      {/* Header with the file path, like SourceTree: it replaces the
          `diff --git`/`index`/`---`/`+++` lines that are no longer rendered. */}
      {selected && (
        <div className="diff-pane-head" title={selected.path}>
          <span className="diff-pane-path">{selected.path}</span>
          {selected.orig_path && (
            <span className="diff-pane-orig muted">← {selected.orig_path}</span>
          )}
          {!selected.untracked ? (
            <span className="diff-pane-counts">
              <span className="added">+{selected.added ?? 0}</span>
              <span className="deleted">-{selected.deleted ?? 0}</span>
            </span>
          ) : (
            untrackedCounts && (
              <span className="diff-pane-counts">
                <span className="added">+{untrackedCounts.added}</span>
                <span className="deleted">-{untrackedCounts.deleted}</span>
              </span>
            )
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
          {t("diff.patch.pointer", {
            oid: pointer.oid.slice(0, 12),
            size: pointer.size,
          })}
        </p>
      )}
      {!selected && !error && <p className="muted status-empty">{t("diff.patch.noFile")}</p>}
      {selected?.untracked && untrackedEmpty && (
        <p className="muted status-empty">{t("diff.patch.emptyFile")}</p>
      )}
      {imagePreview && <ImageDiffPanel />}
      {selected && binary && !imagePreview && (
        <p className="muted status-empty">{t("diff.patch.binary")}</p>
      )}
      {selected && !binary && patch !== "" && !untrackedEmpty && mode === "unified" && (
        <PatchView
          patch={patch}
          staging={patchActions && !previewOnly}
          stagedSide={selected.staged}
          selectedLines={selectedLines}
          onToggleLine={toggleLine}
          onApply={(selection) => void applySelection(selection)}
          onDiscard={
            patchActions && !previewOnly && !selected.staged
              ? (selection) => void confirmDiscard(selection)
              : undefined
          }
        />
      )}
      {selected && !binary && patch !== "" && !untrackedEmpty && mode === "side" && (
        <DiffEditor patch={patch} fileName={selected.path} mode={mode} />
      )}
      {paneMenu.menu}
    </div>
  );
}
