import { useEffect, useState } from "react";
import { copyText } from "../lib/clipboard";
import { confirmDestructive } from "../lib/bridge/dialog";
import type { FileStatus } from "../lib/bridge/types";
import { LAYOUT_KEYS } from "../lib/layout";
import { useRepoStore } from "../lib/stores/repo";
import { useConflictStore } from "../lib/stores/conflict";
import { useDiffStore } from "../lib/stores/diff";
import { useExtrasStore } from "../lib/stores/extras";
import { useStatusStore } from "../lib/stores/status";
import { useUiStore } from "../lib/stores/ui";
import { CommitPanel } from "./CommitPanel";
import { DiffPatchPanel } from "./DiffPatchPanel";
import { SplitPane } from "./SplitPane";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { FileTree } from "./FileTree";

type SortMode = "path" | "status";

/** Un fichero con cambios en el index va a "Staged"; el resto, a "Unstaged". */
function isStaged(entry: FileStatus): boolean {
  return entry.kind !== "untracked" && entry.kind !== "unmerged" && entry.xy[0] !== ".";
}

/** Glifo y color por estado, como los iconos de la lista de SourceTree. */
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
  const setActiveView = useUiStore((state) => state.setActiveView);
  const lfs = useExtrasStore((state) => state.lfs);
  const fileTree = useUiStore((state) => state.fileTree);
  const setFileTree = useUiStore((state) => state.setFileTree);
  const fileMenu = useContextMenu();
  const [sort, setSort] = useState<SortMode>("path");

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
    // A diferencia de antes, no se salta a la vista Diff: el contenido se
    // pinta al lado, como la ventana de commit de SourceTree.
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
        ? `Discard changes in ${entry.path}? This cannot be undone.`
        : `Delete untracked file ${entry.path}? This cannot be undone.`;
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
    { label: "Open diff", onSelect: () => void openDiff(entry, staged) },
    staged
      ? { label: "Unstage", onSelect: () => void unstage(entry.path, entry.orig_path) }
      : { label: "Stage", onSelect: () => void stage(entry.path, entry.orig_path) },
    ...(staged || entry.kind === "unmerged"
      ? []
      : [
          {
            label: "Discard",
            danger: true,
            onSelect: () =>
              void confirmAndRun(entry, entry.kind === "untracked" ? "delete" : "discard"),
          },
        ]),
    { label: "Copy path", onSelect: () => void copyText(entry.path) },
  ];

  const renderRow = (entry: FileStatus, staged: boolean, displayPath = entry.path) => {
    const badge = statusBadge(entry, staged);
    return (
      <div
        key={`${staged ? "staged" : "unstaged"}-${entry.path}`}
        className={`status-row${selected === entry.path ? " selected" : ""}`}
        onClick={() => void openDiff(entry, staged)}
        onContextMenu={(event) => fileMenu.open(event, menuItems(entry, staged))}
      >
        <input
          type="checkbox"
          className="status-check"
          aria-label={`${staged ? "Unstage" : "Stage"} ${entry.path}`}
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
          aria-label={`Actions for ${entry.path}`}
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
  // Un conflicto no se "stagea": primero se resuelve.
  const stageable = unstaged.filter((entry) => entry.kind !== "unmerged");
  const total = report?.entries.length ?? 0;

  return (
    <div className="status-view" aria-label="File status">
      {lfs?.configured && !lfs.installed && (
        <p role="alert" className="lfs-warning">
          This repository uses Git LFS but git-lfs is not installed: LFS files show as pointers.
        </p>
      )}
      <div className="status-toolbar">
        <label className="status-sort">
          <span>Pending files,</span>
          <select
            aria-label="Sort files"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
          >
            <option value="path">sorted by path</option>
            <option value="status">sorted by status</option>
          </select>
        </label>
        <div className="status-right">
          <input
            type="search"
            aria-label="Search files"
            placeholder="Search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
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
        label="Resize commit area"
      >
        <SplitPane
          className="status-body"
          direction="horizontal"
          side="start"
          storageKey={LAYOUT_KEYS.statusFiles}
          defaultSize={410}
          min={240}
          max={720}
          label="Resize pending files"
        >
          <div className="status-files">
            {report && total === 0 && <p className="muted status-empty">No changes</p>}
            <section className="status-section">
              <div className="status-section-head">
                <input
                  type="checkbox"
                  aria-label="Unstage all files"
                  checked={staged.length > 0}
                  disabled={staged.length === 0}
                  onChange={() => void unstageMany(staged)}
                />
                <h3>
                  Staged files <span className="count">{staged.length}</span>
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
            <section className="status-section">
              <div className="status-section-head">
                <input
                  type="checkbox"
                  aria-label="Stage all files"
                  checked={false}
                  disabled={stageable.length === 0}
                  onChange={() => void stageMany(stageable)}
                />
                <h3>
                  Unstaged files <span className="count">{unstaged.length}</span>
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
            {loading && <p className="muted status-empty">Loading…</p>}
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
