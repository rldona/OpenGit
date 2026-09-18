import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classifyRef, formatAuthor, formatCommitDate, shortRefName } from "../lib/format";
import { ROW_HEIGHT, graphWidth as graphWidthFor, visibleLaneCount } from "../lib/graph/layout";
import { sameRange, visibleRange, type VisibleRange } from "../lib/graph/viewport";
import { copyText } from "../lib/clipboard";
import { COLUMN_LABELS, loadColumnWidths, saveColumnWidths, type ColumnName } from "../lib/columns";
import { LAYOUT_KEYS } from "../lib/layout";
import { useCommitActions } from "../lib/hooks/useCommitActions";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import type { LogSearch } from "../lib/bridge/types";
import { useLogStore } from "../lib/stores/log";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";
import { ColumnResizer } from "./ColumnResizer";
import { CommitDetailPanel } from "./CommitDetailPanel";
import { Icon } from "./Icon";
import { GraphCanvas } from "./GraphCanvas";
import { SplitPane } from "./SplitPane";

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
  const storedSearch = useLogStore((state) => state.search);
  const applySearch = useLogStore((state) => state.applySearch);
  const clearSearch = useLogStore((state) => state.clearSearch);

  const [widths, setWidths] = useState(loadColumnWidths);
  const setWidth = (column: ColumnName, width: number) =>
    setWidths((current) => ({ ...current, [column]: width }));

  useEffect(() => {
    saveColumnWidths(widths);
  }, [widths]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState<VisibleRange>({ start: 0, end: 0 });
  const [searchForm, setSearchForm] = useState<LogSearch>({ grep: "", author: "", path: "" });
  const commitActions = useCommitActions();
  const commitMenu = useContextMenu();
  const incoming = useRefsStore((state) => state.incoming);
  const outgoing = useRefsStore((state) => state.outgoing);
  const incomingSet = useMemo(() => new Set(incoming), [incoming]);
  const outgoingSet = useMemo(() => new Set(outgoing), [outgoing]);

  const searchActive =
    storedSearch.grep !== "" || storedSearch.author !== "" || storedSearch.path !== "";
  const runSearch = () => {
    if (root) {
      void applySearch(root, searchForm);
    }
  };
  const resetSearch = () => {
    setSearchForm({ grep: "", author: "", path: "" });
    if (root) {
      void clearSearch(root);
    }
  };

  const root = repo?.root ?? null;
  const rows = layout.rows;

  const searchFocusRequest = useUiStore((state) => state.searchFocusRequest);
  const searchMessageRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  useEffect(() => {
    if (searchFocusRequest > 0) {
      searchMessageRef.current?.focus();
    }
  }, [searchFocusRequest]);

  const updateRange = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    const next = visibleRange(scroller.scrollTop, scroller.clientHeight, rows.length);
    setRange((current) => (sameRange(current, next) ? current : next));
    if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < ROW_HEIGHT * 12) {
      void loadMore();
    }
  }, [rows.length, loadMore]);

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

  // Medido sobre el rango visible, no sobre todo el historial: ver OG-047.
  const laneCount = visibleLaneCount(rows, range.start, range.end);
  const graphWidth = graphWidthFor(laneCount);

  const visible = rows.slice(range.start, range.end);
  const selectedCommit = selected
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
        <div className="history-search">
          <input
            ref={searchMessageRef}
            type="search"
            aria-label="Search message"
            placeholder="Message"
            value={searchForm.grep}
            onChange={(event) => setSearchForm({ ...searchForm, grep: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch();
            }}
          />
          <input
            type="search"
            aria-label="Search author"
            placeholder="Author"
            value={searchForm.author}
            onChange={(event) => setSearchForm({ ...searchForm, author: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch();
            }}
          />
          <input
            type="search"
            aria-label="Search file"
            placeholder="File path"
            value={searchForm.path}
            onChange={(event) => setSearchForm({ ...searchForm, path: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch();
            }}
          />
          <button type="button" onClick={runSearch}>
            Search
          </button>
          {searchActive && (
            <button type="button" onClick={resetSearch}>
              Clear
            </button>
          )}
        </div>
      </div>

      <SplitPane
        className="history-body"
        direction="vertical"
        side="end"
        storageKey={LAYOUT_KEYS.historyBottom}
        defaultSize={320}
        min={160}
        max={720}
        label="Resize commit details"
        collapsed={!selectedCommit}
      >
        <div className="history-list-wrap">
          <div className="commit-header">
            <span className="commit-header-graph" style={{ width: graphWidth }}>
              Graph
            </span>
            <span className="commit-header-cell">Description</span>
            {(Object.keys(COLUMN_LABELS) as ColumnName[]).map((column) => (
              <Fragment key={column}>
                <ColumnResizer
                  column={column}
                  label={COLUMN_LABELS[column]}
                  width={widths[column]}
                  onResize={(width) => setWidth(column, width)}
                />
                <span
                  className={`commit-header-cell commit-header-${column}`}
                  style={{ width: widths[column] }}
                >
                  {COLUMN_LABELS[column]}
                </span>
              </Fragment>
            ))}
          </div>
          <GraphCanvas
            rows={rows}
            colors={layout.colors}
            laneCount={laneCount}
            selected={selected}
            scrollRef={scrollRef}
          />
          <div className="history-list" ref={scrollRef} onScroll={updateRange}>
            <div className="history-inner" style={{ height: rows.length * ROW_HEIGHT }}>
              {visible.map((row, offset) => {
                const index = range.start + offset;
                const commit = commits[index];
                if (!commit) {
                  return null;
                }
                return (
                  <button
                    key={row.hash}
                    type="button"
                    className={`commit-row${selected === row.hash ? " selected" : ""}${
                      incomingSet.has(commit.hash) ? " incoming" : ""
                    }${outgoingSet.has(commit.hash) ? " outgoing" : ""}`}
                    style={{ top: index * ROW_HEIGHT, paddingLeft: graphWidth }}
                    onClick={() => select(row.hash)}
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
        {selectedCommit ? (
          <CommitDetailPanel commit={selectedCommit} onClose={() => select(null)} />
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
