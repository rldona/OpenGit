import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classifyRef, formatAuthor, formatCommitDate, shortRefName } from "../lib/format";
import { ROW_HEIGHT, graphWidth as graphWidthFor, visibleLaneCount } from "../lib/graph/layout";
import { sameRange, visibleRange, type VisibleRange } from "../lib/graph/viewport";
import { copyText } from "../lib/clipboard";
import { COLUMN_LABELS, loadColumnWidths, saveColumnWidths, type ColumnName } from "../lib/columns";
import { LAYOUT_KEYS } from "../lib/layout";
import { useCommitActions } from "../lib/hooks/useCommitActions";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { WORKTREE_SELECTION, useLogStore } from "../lib/stores/log";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
import { ColumnResizer } from "./ColumnResizer";
import { CommitDetailPanel } from "./CommitDetailPanel";
import { Icon } from "./Icon";
import { GraphCanvas } from "./GraphCanvas";
import { SplitPane } from "./SplitPane";
import { WorktreeDetailPanel } from "./WorktreeDetailPanel";

export function HistoryView() {
  const repo = useRepoStore((state) => state.repo);
  const commits = useLogStore((state) => state.commits);
  const layout = useLogStore((state) => state.layout);
  const refs = useLogStore((state) => state.refs);
  const filter = useLogStore((state) => state.filter);
  const selected = useLogStore((state) => state.selected);
  const loading = useLogStore((state) => state.loading);
  const load = useLogStore((state) => state.load);
  const loadMore = useLogStore((state) => state.loadMore);
  const setFilter = useLogStore((state) => state.setFilter);
  const select = useLogStore((state) => state.select);

  const [widths, setWidths] = useState(loadColumnWidths);
  const setWidth = (column: ColumnName, width: number) =>
    setWidths((current) => ({ ...current, [column]: width }));

  useEffect(() => {
    saveColumnWidths(widths);
  }, [widths]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState<VisibleRange>({ start: 0, end: 0 });
  const commitActions = useCommitActions();
  const commitMenu = useContextMenu();
  const incoming = useRefsStore((state) => state.incoming);
  const outgoing = useRefsStore((state) => state.outgoing);
  const incomingSet = useMemo(() => new Set(incoming), [incoming]);
  const outgoingSet = useMemo(() => new Set(outgoing), [outgoing]);

  const root = repo?.root ?? null;
  const rows = layout.rows;
  const changes = useStatusStore((state) => state.report?.entries.length ?? 0);
  // La fila "Uncommitted changes" solo tiene sentido con cambios pendientes.
  const showWorktree = changes > 0;
  const worktreeSelected = selected === WORKTREE_SELECTION;
  const totalRows = rows.length + (showWorktree ? 1 : 0);
  const commitOffset = showWorktree ? 1 : 0;

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  const updateRange = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    const next = visibleRange(scroller.scrollTop, scroller.clientHeight, totalRows);
    setRange((current) => (sameRange(current, next) ? current : next));
    if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < ROW_HEIGHT * 12) {
      void loadMore();
    }
  }, [totalRows, loadMore]);

  useEffect(() => {
    updateRange();
  }, [updateRange]);

  // El panel inferior cambia la altura del scroller: sin esto el virtualizado
  // seguiría pintando el número de filas de la altura anterior.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => updateRange());
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [updateRange]);

  // Localiza en la lista virtualizada el commit pedido desde la sidebar
  // (una tag, por ejemplo): lo selecciona el store y aquí lo traemos a la vista.
  const revealRequest = useLogStore((state) => state.revealRequest);
  const handledReveal = useRef(0);
  useEffect(() => {
    if (revealRequest === handledReveal.current) {
      return;
    }
    handledReveal.current = revealRequest;
    const { selected: hash, commits: list } = useLogStore.getState();
    const scroller = scrollRef.current;
    if (!hash || !scroller) {
      return;
    }
    const index = list.findIndex((commit) => commit.hash === hash);
    if (index < 0) {
      return;
    }
    scroller.scrollTop = Math.max(
      0,
      (index + commitOffset) * ROW_HEIGHT - Math.round(scroller.clientHeight / 3),
    );
    updateRange();
  }, [revealRequest, commitOffset, updateRange]);

  // Medido sobre el rango visible, no sobre todo el historial: ver OG-047.
  const laneCount = visibleLaneCount(
    rows,
    Math.max(0, range.start - commitOffset),
    Math.max(0, range.end - commitOffset),
  );
  const graphWidth = graphWidthFor(laneCount);

  const visible = Array.from({ length: Math.max(0, range.end - range.start) }, (_, offset) => {
    const index = range.start + offset;
    if (showWorktree && index === 0) {
      return { index, worktree: true as const };
    }
    const commitIndex = index - commitOffset;
    return {
      index,
      worktree: false as const,
      commit: commits[commitIndex],
      row: rows[commitIndex],
    };
  });
  const selectedCommit =
    selected && !worktreeSelected
      ? (commits.find((commit) => commit.hash === selected) ?? null)
      : null;
  // Solo ramas locales: incluir `refs/remotes/` volcaba aquí las miles de
  // ramas del remoto y dejaba el desplegable inservible.
  const branchRefs = refs.filter((ref) => ref.name.startsWith("refs/heads/"));

  return (
    <div className="history">
      <div className="history-toolbar">
        <label className="history-filter">
          <span>Branch</span>
          <select
            value={filter ?? ""}
            onChange={(event) => {
              if (root) {
                void setFilter(root, event.target.value || null);
              }
            }}
          >
            <option value="">All branches</option>
            {branchRefs.map((ref) => (
              <option key={ref.name} value={ref.name}>
                {shortRefName(ref.name)}
              </option>
            ))}
          </select>
        </label>
        {loading && <span className="muted">Loading…</span>}
      </div>

      <SplitPane
        className="history-body"
        direction="vertical"
        side="end"
        storageKey={LAYOUT_KEYS.historyBottom}
        defaultSize={520}
        min={160}
        max={720}
        label="Resize commit details"
        collapsed={!selectedCommit && !worktreeSelected}
      >
        <div className="history-list-wrap">
          <div className="commit-header">
            <span className="commit-header-graph" style={{ width: graphWidth }}>
              Graph
            </span>
            <span className="commit-header-cell">Description</span>
            {(Object.keys(COLUMN_LABELS) as ColumnName[]).map((column) => (
              <div
                key={column}
                className={`commit-header-cell commit-header-${column}`}
                style={{ width: widths[column] }}
              >
                <ColumnResizer
                  column={column}
                  label={COLUMN_LABELS[column]}
                  width={widths[column]}
                  onResize={(width) => setWidth(column, width)}
                />
                {COLUMN_LABELS[column]}
              </div>
            ))}
          </div>
          <GraphCanvas
            rows={rows}
            colors={layout.colors}
            laneCount={laneCount}
            selected={selected}
            scrollRef={scrollRef}
            offset={commitOffset}
            worktree={showWorktree}
          />
          <div className="history-list" ref={scrollRef} onScroll={updateRange}>
            <div className="history-inner" style={{ height: totalRows * ROW_HEIGHT }}>
              {visible.map((row) => {
                const index = row.index;
                if (row.worktree) {
                  return (
                    <button
                      key="worktree"
                      type="button"
                      className={`commit-row worktree-row${worktreeSelected ? " selected" : ""}`}
                      style={{ top: index * ROW_HEIGHT, paddingLeft: graphWidth }}
                      onClick={() => select(WORKTREE_SELECTION)}
                    >
                      <span className="commit-subject">Uncommitted changes</span>
                      <span className="commit-hash" style={{ width: widths.hash }} />
                      <span className="commit-author" style={{ width: widths.author }} />
                      <span className="commit-date" style={{ width: widths.date }}>
                        {formatCommitDate(Math.floor(Date.now() / 1000))}
                      </span>
                    </button>
                  );
                }
                const rowData = row.row;
                const commit = row.commit;
                if (!commit || !rowData) {
                  return null;
                }
                return (
                  <button
                    key={rowData.hash}
                    type="button"
                    className={`commit-row${selected === rowData.hash ? " selected" : ""}${
                      incomingSet.has(commit.hash) ? " incoming" : ""
                    }${outgoingSet.has(commit.hash) ? " outgoing" : ""}`}
                    style={{ top: index * ROW_HEIGHT, paddingLeft: graphWidth }}
                    onClick={() => select(rowData.hash)}
                    onContextMenu={(event) =>
                      commitMenu.open(event, [
                        {
                          label: "Open in Diff view",
                          onSelect: () => void commitActions.showDiff(commit),
                        },
                        {
                          label: "Cherry-pick",
                          onSelect: () => void commitActions.cherryPick(commit),
                        },
                        { label: "Revert", onSelect: () => void commitActions.revert(commit) },
                        {
                          label: "Reset to here",
                          onSelect: () => void commitActions.reset(commit),
                        },
                        {
                          label: "Interactive rebase from here",
                          onSelect: () => void commitActions.rebase(commit),
                        },
                        { label: "Copy hash", onSelect: () => void copyText(commit.hash) },
                      ])
                    }
                  >
                    {commit.refs.length > 0 && (
                      <span className="commit-refs">{renderRefs(commit.refs)}</span>
                    )}
                    {incomingSet.has(commit.hash) && (
                      <span className="commit-track incoming" title="Incoming commit">
                        ↓
                      </span>
                    )}
                    {outgoingSet.has(commit.hash) && (
                      <span className="commit-track outgoing" title="Outgoing commit">
                        ↑
                      </span>
                    )}
                    <span className="commit-subject">{commit.subject}</span>
                    <span className="commit-hash" style={{ width: widths.hash }}>
                      {commit.hash.slice(0, 7)}
                    </span>
                    <span
                      className="commit-author"
                      style={{ width: widths.author }}
                      title={formatAuthor(commit.author_name, commit.author_email)}
                    >
                      {formatAuthor(commit.author_name, commit.author_email)}
                    </span>
                    <span className="commit-date" style={{ width: widths.date }}>
                      {formatCommitDate(commit.author_time)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {worktreeSelected && root ? (
          <WorktreeDetailPanel root={root} />
        ) : selectedCommit ? (
          <CommitDetailPanel commit={selectedCommit} />
        ) : null}
      </SplitPane>

      {commitMenu.menu}
    </div>
  );
}

function renderRefs(refValues: string[]) {
  const shown = refValues.slice(0, 3);
  return (
    <>
      {shown.map((value) => (
        <RefBadge key={value} value={value} />
      ))}
      {refValues.length > shown.length && (
        <span className="muted">+{refValues.length - shown.length}</span>
      )}
    </>
  );
}

function RefBadge({ value }: { value: string }) {
  const { kind, label } = classifyRef(value);
  return (
    <span className={`ref-badge ${kind}`} title={label}>
      <Icon name={kind === "tag" ? "tag" : "branch"} size={10} />
      <span className="ref-badge-label">{label}</span>
    </span>
  );
}
