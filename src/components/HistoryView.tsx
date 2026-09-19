import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { classifyRef, formatAuthor, formatCommitDate, shortRefName } from "../lib/format";
import { ROW_HEIGHT, graphWidth as graphWidthFor, visibleLaneCount } from "../lib/graph/layout";
import { sameRange, visibleRange, type VisibleRange } from "../lib/graph/viewport";
import { copyText } from "../lib/clipboard";
import {
  COLUMN_LABELS,
  loadColumnWidths,
  nextSort,
  saveColumnWidths,
  sortCommits,
  type ColumnName,
  type SortColumn,
  type SortOrder,
} from "../lib/columns";
import { LAYOUT_KEYS } from "../lib/layout";
import { useCommitActions } from "../lib/hooks/useCommitActions";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { WORKTREE_SELECTION, useLogStore } from "../lib/stores/log";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
import { useUiStore } from "../lib/stores/ui";
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
  const search = useLogStore((state) => state.search);
  const selected = useLogStore((state) => state.selected);
  const loading = useLogStore((state) => state.loading);
  const hasMore = useLogStore((state) => state.hasMore);
  const load = useLogStore((state) => state.load);
  const loadMore = useLogStore((state) => state.loadMore);
  const setFilter = useLogStore((state) => state.setFilter);
  const applySearch = useLogStore((state) => state.applySearch);
  const clearSearch = useLogStore((state) => state.clearSearch);
  const select = useLogStore((state) => state.select);

  const searchFocusRequest = useUiStore((state) => state.searchFocusRequest);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const handledFocus = useRef(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [grep, setGrep] = useState("");
  const [author, setAuthor] = useState("");
  const [path, setPath] = useState("");
  const searching = search !== null;

  // `mod+f`: the App switches to History and requests the focus here.
  useEffect(() => {
    if (searchFocusRequest === 0 || searchFocusRequest === handledFocus.current) {
      return;
    }
    handledFocus.current = searchFocusRequest;
    setSearchOpen(true);
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [searchFocusRequest]);

  const [widths, setWidths] = useState(loadColumnWidths);
  const setWidth = (column: ColumnName, width: number) =>
    setWidths((current) => ({ ...current, [column]: width }));
  // `null` = git's topological order, the only one where the graph fits (OG-045).
  const [sort, setSort] = useState<SortOrder | null>(null);

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
  // Presentation order: git's topological one or the one chosen in the header (OG-045).
  const displayed = useMemo(() => sortCommits(commits, sort), [commits, sort]);
  const changes = useStatusStore((state) => state.report?.entries.length ?? 0);
  // The "Uncommitted changes" row only makes sense with pending changes.
  const showWorktree = changes > 0;
  const worktreeSelected = selected === WORKTREE_SELECTION;
  const totalRows = rows.length + (showWorktree ? 1 : 0);
  const commitOffset = showWorktree ? 1 : 0;

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (root) {
      void applySearch(root, { grep, author, path });
    }
  };

  const clear = () => {
    setGrep("");
    setAuthor("");
    setPath("");
    if (root) {
      void clearSearch(root);
    }
  };

  const hasDraft = grep.trim() !== "" || author.trim() !== "" || path.trim() !== "";

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  // A new repository starts with an empty search: both in the store
  // (`load` resets it) and in these drafts.
  useEffect(() => {
    setGrep("");
    setAuthor("");
    setPath("");
  }, [root]);

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

  // The bottom panel changes the scroller height: without this the virtualized
  // list would keep painting the row count of the previous height.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => updateRange());
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [updateRange]);

  // Locates in the virtualized list the commit requested from the sidebar
  // (a tag, for example): the store selects it and here we bring it into view.
  const revealRequest = useLogStore((state) => state.revealRequest);
  const handledReveal = useRef(0);
  useEffect(() => {
    if (revealRequest === handledReveal.current) {
      return;
    }
    handledReveal.current = revealRequest;
    const { selected: hash } = useLogStore.getState();
    const scroller = scrollRef.current;
    if (!hash || !scroller) {
      return;
    }
    const index = displayed.findIndex((commit) => commit.hash === hash);
    if (index < 0) {
      return;
    }
    scroller.scrollTop = Math.max(
      0,
      (index + commitOffset) * ROW_HEIGHT - Math.round(scroller.clientHeight / 3),
    );
    updateRange();
  }, [revealRequest, displayed, commitOffset, updateRange]);

  // Measured over the visible range, not over the whole history: see OG-047.
  const laneCount = visibleLaneCount(
    rows,
    Math.max(0, range.start - commitOffset),
    Math.max(0, range.end - commitOffset),
  );
  // Sorting by column breaks the coherence of the graph: it is hidden and
  // Description uses the width (decision noted in OG-045).
  const sorted = sort !== null;
  const graphWidth = sorted ? 0 : graphWidthFor(laneCount);

  const visible = Array.from({ length: Math.max(0, range.end - range.start) }, (_, offset) => {
    const index = range.start + offset;
    if (showWorktree && index === 0) {
      return { index, worktree: true as const };
    }
    const commitIndex = index - commitOffset;
    return {
      index,
      worktree: false as const,
      commit: displayed[commitIndex],
      row: rows[commitIndex],
    };
  });
  const selectedCommit =
    selected && !worktreeSelected
      ? (displayed.find((commit) => commit.hash === selected) ?? null)
      : null;
  // Local branches only: including `refs/remotes/` dumped the thousands of
  // remote branches here and left the dropdown unusable.
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

        <form className="history-search" onSubmit={submitSearch} role="search">
          <input
            ref={searchInputRef}
            className="history-search-message"
            type="search"
            value={grep}
            placeholder="Search message"
            aria-label="Search message"
            onChange={(event) => setGrep(event.target.value)}
          />
          <button
            type="button"
            className="history-search-toggle"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            Filters
          </button>
          {searchOpen && (
            <>
              <input
                type="text"
                value={author}
                placeholder="Author"
                aria-label="Search author"
                onChange={(event) => setAuthor(event.target.value)}
              />
              <input
                type="text"
                value={path}
                placeholder="Path"
                aria-label="Search path"
                onChange={(event) => setPath(event.target.value)}
              />
            </>
          )}
          <button type="submit" className="history-search-submit">
            Search
          </button>
          {(searching || hasDraft) && (
            <button type="button" className="history-search-clear" onClick={clear}>
              Clear
            </button>
          )}
          {searching && (
            <span className="history-search-count muted">
              {commits.length}
              {hasMore ? "+" : ""} {commits.length === 1 ? "result" : "results"}
            </span>
          )}
        </form>

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
            {!sorted && (
              <span className="commit-header-graph" style={{ width: graphWidth }}>
                Graph
              </span>
            )}
            <div className="commit-header-cell commit-header-description">
              <SortButton column="description" label="Description" sort={sort} onSort={setSort} />
            </div>
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
                <SortButton
                  column={column}
                  label={COLUMN_LABELS[column]}
                  sort={sort}
                  onSort={setSort}
                />
              </div>
            ))}
          </div>
          {!sorted && (
            <GraphCanvas
              rows={rows}
              colors={layout.colors}
              laneCount={laneCount}
              selected={selected}
              scrollRef={scrollRef}
              offset={commitOffset}
              worktree={showWorktree}
            />
          )}
          {searching && !loading && commits.length === 0 && (
            <p className="history-empty muted">No commits match the search</p>
          )}
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

function SortButton({
  column,
  label,
  sort,
  onSort,
}: {
  column: SortColumn;
  label: string;
  sort: SortOrder | null;
  onSort: (order: SortOrder | null) => void;
}) {
  const active = sort?.column === column;
  const indicator = active ? (sort.direction === "asc" ? "▲" : "▼") : "";
  return (
    <button
      type="button"
      className={`commit-header-sort${active ? " active" : ""}`}
      aria-label={`Sort by ${label}`}
      onClick={() => onSort(nextSort(sort, column))}
    >
      {label}
      {indicator !== "" && <span className="commit-header-indicator">{indicator}</span>}
    </button>
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
