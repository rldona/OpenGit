import { useEffect, useState } from "react";
import { copyText } from "../lib/clipboard";
import { confirmDestructive } from "../lib/bridge/dialog";
import type { FileStatus } from "../lib/bridge/types";
import { useI18n } from "../lib/i18n";
import { LAYOUT_KEYS } from "../lib/layout";
import { openFileDefault, openFileEditor, revealFile } from "../lib/openFiles";
import { useRepoStore } from "../lib/stores/repo";
import { useConflictStore } from "../lib/stores/conflict";
import { useDiffStore } from "../lib/stores/diff";
import { useExtrasStore } from "../lib/stores/extras";
import { useBlameStore } from "../lib/stores/blame";
import { useLogStore } from "../lib/stores/log";
import { useDragStore } from "../lib/stores/drag";
import { useDragSource } from "../lib/hooks/useDragSource";
import { useStatusStore } from "../lib/stores/status";
import { useUiStore } from "../lib/stores/ui";
import { CommitPanel } from "./CommitPanel";
import { DiffPatchPanel } from "./DiffPatchPanel";
import { SplitPane } from "./SplitPane";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { FileTree } from "./FileTree";

type SortMode = "path" | "status";

/** A file with changes in the index goes to "Staged"; the rest, to "Unstaged". */
function isStaged(entry: FileStatus): boolean {
  return entry.kind !== "untracked" && entry.kind !== "unmerged" && entry.xy[0] !== ".";
}

/** Glyph and color per status, like the icons in the SourceTree list. */
function statusBadge(entry: FileStatus, staged: boolean): { glyph: string; tone: string } {
  if (entry.kind === "unmerged") {
    return { glyph: "!", tone: "conflict" };
  }
  if (entry.kind === "untracked") {
    return { glyph: "?", tone: "untracked" };
  }
  const code = (staged ? entry.xy[0] : entry.xy[1]) || "?";
  switch (code) {
    case "A":
      return { glyph: "A", tone: "added" };
    case "D":
      return { glyph: "D", tone: "deleted" };
    case "M":
      return { glyph: "M", tone: "modified" };
    default:
      return { glyph: code, tone: "muted" };
  }
}

function sortEntries(entries: FileStatus[], mode: SortMode): FileStatus[] {
  return [...entries].sort((a, b) =>
    mode === "status"
      ? a.xy.localeCompare(b.xy) || a.path.localeCompare(b.path)
      : a.path.localeCompare(b.path),
  );
}

export function StatusView() {
  const { t } = useI18n();
  const repo = useRepoStore((state) => state.repo);
  const report = useStatusStore((state) => state.report);
  const filter = useStatusStore((state) => state.filter);
  const selected = useStatusStore((state) => state.selected);
  const loading = useStatusStore((state) => state.loading);
  const load = useStatusStore((state) => state.load);
  const setFilter = useStatusStore((state) => state.setFilter);
  const select = useStatusStore((state) => state.select);
  const stage = useStatusStore((state) => state.stage);
  const unstage = useStatusStore((state) => state.unstage);
  const stageMany = useStatusStore((state) => state.stageMany);
  const unstageMany = useStatusStore((state) => state.unstageMany);
  const discard = useStatusStore((state) => state.discard);
  const removeUntracked = useStatusStore((state) => state.removeUntracked);
  const openWorktreeFile = useDiffStore((state) => state.openWorktreeFile);
  const openConflict = useConflictStore((state) => state.open);
  const showFileHistory = useLogStore((state) => state.showFileHistory);
  const openBlame = useBlameStore((state) => state.open);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const lfs = useExtrasStore((state) => state.lfs);
  const fileTree = useUiStore((state) => state.fileTree);
  const setFileTree = useUiStore((state) => state.setFileTree);
  const fileMenu = useContextMenu();
  const [sort, setSort] = useState<SortMode>("path");

  const drag = useDragSource((payload, target) => {
    if (payload.kind !== "file") {
      return;
    }
    if (target === "status-staged" && !payload.staged) {
      void stage(payload.path, payload.origPath);
    } else if (target === "status-unstaged" && payload.staged) {
      void unstage(payload.path, payload.origPath);
    }
  });
  const dragPayload = useDragStore((state) => state.drag);
  const dragOver = useDragStore((state) => state.over);

  const root = repo?.root ?? null;

  const openDiff = async (entry: FileStatus, staged: boolean) => {
    if (!root) {
      return;
    }
    select(entry.path);
    if (entry.kind === "unmerged") {
      await openConflict(root, entry.path);
      setActiveView("conflict");
      return;
    }
    // Unlike before, it does not jump to the Diff view: the content is
    // rendered alongside, like SourceTree's commit window.
    await openWorktreeFile(root, entry.path, staged);
  };

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  const confirmAndRun = async (entry: FileStatus, action: "discard" | "delete") => {
    const message =
      action === "discard"
        ? t("status.discardConfirm", { path: entry.path })
        : t("status.deleteConfirm", { path: entry.path });
    const confirmed = await confirmDestructive(message);
    if (!confirmed) {
      return;
    }
    if (action === "discard") {
      await discard(entry.path, entry.orig_path);
    } else {
      await removeUntracked(entry.path);
    }
  };

  const menuItems = (entry: FileStatus, staged: boolean) => [
    { label: t("status.openDiff"), onSelect: () => void openDiff(entry, staged) },
    {
      label: t("diff.files.showHistory"),
      onSelect: () => root && void showFileHistory(root, entry.path),
    },
    ...(entry.kind === "untracked"
      ? []
      : [
          {
            label: t("diff.files.blame"),
            onSelect: () => root && void openBlame(root, entry.path),
          },
        ]),
    ...(root
      ? [
          { label: t("diff.files.open"), onSelect: () => openFileDefault(root, entry.path) },
          {
            label: t("diff.files.openInEditor"),
            onSelect: () => openFileEditor(root, entry.path),
          },
          { label: t("diff.files.showInFinder"), onSelect: () => revealFile(root, entry.path) },
        ]
      : []),
    staged
      ? { label: t("status.unstage"), onSelect: () => void unstage(entry.path, entry.orig_path) }
      : { label: t("status.stage"), onSelect: () => void stage(entry.path, entry.orig_path) },
    ...(staged || entry.kind === "unmerged"
      ? []
      : [
          {
            label: t("status.discard"),
            danger: true,
            onSelect: () =>
              void confirmAndRun(entry, entry.kind === "untracked" ? "delete" : "discard"),
          },
        ]),
    { label: t("diff.files.copyPath"), onSelect: () => void copyText(entry.path) },
  ];

  const renderRow = (entry: FileStatus, staged: boolean, displayPath = entry.path) => {
    const badge = statusBadge(entry, staged);
    return (
      <div
        key={`${staged ? "staged" : "unstaged"}-${entry.path}`}
        className={`status-row${selected === entry.path ? " selected" : ""}`}
        onClick={() => void openDiff(entry, staged)}
        onContextMenu={(event) => fileMenu.open(event, menuItems(entry, staged))}
        onPointerDown={(event) =>
          drag.start(event, {
            kind: "file",
            path: entry.path,
            origPath: entry.orig_path,
            staged,
          })
        }
      >
        <input
          type="checkbox"
          className="status-check"
          aria-label={`${staged ? t("status.unstage") : t("status.stage")} ${entry.path}`}
          checked={staged}
          onClick={(event) => event.stopPropagation()}
          onChange={() =>
            staged
              ? void unstage(entry.path, entry.orig_path)
              : void stage(entry.path, entry.orig_path)
          }
        />
        <span className={`status-badge ${badge.tone}`} aria-hidden="true">
          {badge.glyph}
        </span>
        <span className="status-path" title={entry.path}>
          {displayPath}
          {entry.orig_path && <span className="muted"> ← {entry.orig_path}</span>}
        </span>
        <button
          type="button"
          className="status-more"
          aria-label={t("status.actionsFor", { path: entry.path })}
          onClick={(event) => {
            event.stopPropagation();
            fileMenu.open(event, menuItems(entry, staged));
          }}
        >
          ⋯
        </button>
      </div>
    );
  };

  const term = filter.trim().toLowerCase();
  const entries = (report?.entries ?? []).filter(
    (entry) =>
      term === "" ||
      entry.path.toLowerCase().includes(term) ||
      (entry.orig_path ?? "").toLowerCase().includes(term),
  );
  const staged = sortEntries(entries.filter(isStaged), sort);
  const unstaged = sortEntries(
    entries.filter((entry) => !isStaged(entry)),
    sort,
  );
  // A conflict is not "staged": it is resolved first.
  const stageable = unstaged.filter((entry) => entry.kind !== "unmerged");
  const total = report?.entries.length ?? 0;

  return (
    <div className="status-view" aria-label={t("status.aria")}>
      {lfs?.configured && !lfs.installed && (
        <p role="alert" className="lfs-warning">
          {t("status.lfsWarning")}
        </p>
      )}
      <div className="status-toolbar">
        <label className="status-sort">
          <span>{t("status.pendingFiles")}</span>
          <select
            aria-label={t("status.sortFiles")}
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
          >
            <option value="path">{t("status.sortedByPath")}</option>
            <option value="status">{t("status.sortedByStatus")}</option>
          </select>
        </label>
        <div className="status-right">
          <input
            type="search"
            aria-label={t("status.searchFiles")}
            placeholder={t("status.search")}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <div className="diff-modes">
            <button
              type="button"
              className={fileTree ? "" : "active"}
              onClick={() => setFileTree(false)}
            >
              {t("status.list")}
            </button>
            <button
              type="button"
              className={fileTree ? "active" : ""}
              onClick={() => setFileTree(true)}
            >
              {t("status.tree")}
            </button>
          </div>
        </div>
      </div>

      <SplitPane
        className="status-layout"
        direction="vertical"
        side="end"
        storageKey={LAYOUT_KEYS.statusCommit}
        defaultSize={350}
        min={130}
        max={620}
        label={t("status.resizeCommitArea")}
      >
        <SplitPane
          className="status-body"
          direction="horizontal"
          side="start"
          storageKey={LAYOUT_KEYS.statusFiles}
          defaultSize={410}
          min={240}
          max={720}
          label={t("status.resizePending")}
        >
          <div className="status-files">
            {report && total === 0 && <p className="muted status-empty">{t("status.noChanges")}</p>}
            <section
              className={`status-section${
                dragOver === "status-staged" && dragPayload?.kind === "file" ? " drop-target" : ""
              }`}
              data-drop="status-staged"
            >
              <div className="status-section-head">
                <input
                  type="checkbox"
                  aria-label={t("status.unstageAll")}
                  checked={staged.length > 0}
                  disabled={staged.length === 0}
                  onChange={() => void unstageMany(staged)}
                />
                <h3>
                  {t("status.stagedFiles")} <span className="count">{staged.length}</span>
                </h3>
              </div>
              {fileTree ? (
                <FileTree
                  items={staged}
                  pathOf={(entry) => entry.path}
                  renderFile={(entry, name) => renderRow(entry, true, name)}
                />
              ) : (
                staged.map((entry) => renderRow(entry, true))
              )}
            </section>
            <section
              className={`status-section${
                dragOver === "status-unstaged" && dragPayload?.kind === "file" ? " drop-target" : ""
              }`}
              data-drop="status-unstaged"
            >
              <div className="status-section-head">
                <input
                  type="checkbox"
                  aria-label={t("status.stageAll")}
                  checked={false}
                  disabled={stageable.length === 0}
                  onChange={() => void stageMany(stageable)}
                />
                <h3>
                  {t("status.unstagedFiles")} <span className="count">{unstaged.length}</span>
                </h3>
              </div>
              {fileTree ? (
                <FileTree
                  items={unstaged}
                  pathOf={(entry) => entry.path}
                  renderFile={(entry, name) => renderRow(entry, false, name)}
                />
              ) : (
                unstaged.map((entry) => renderRow(entry, false))
              )}
            </section>
            {loading && <p className="muted status-empty">{t("common.loading")}</p>}
          </div>
          <div className="status-screen">
            <DiffPatchPanel />
          </div>
        </SplitPane>
        <CommitPanel />
      </SplitPane>
      {fileMenu.menu}
    </div>
  );
}
