import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime, shortRefName } from "../lib/format";
import { LANE_WIDTH, ROW_HEIGHT } from "../lib/graph/layout";
import { sameRange, visibleRange, type VisibleRange } from "../lib/graph/viewport";
import { copyText } from "../lib/clipboard";
import { LAYOUT_KEYS } from "../lib/layout";
import { useCommitActions } from "../lib/hooks/useCommitActions";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import type { Commit, LogSearch } from "../lib/bridge/types";
import { useLogStore } from "../lib/stores/log";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";
import { GraphCanvas } from "./GraphCanvas";
import { SplitPane } from "./SplitPane";

const GRAPH_PADDING = 16;

export function HistoryView() {
  const repo = useRepoStore((state) => state.repo);
  const commits = useLogStore((state) => state.commits);
  const layout = useLogStore((state) => state.layout);
  const refs = useLogStore((state) => state.refs);
  const filter = useLogStore((state) => state.filter);
  const selected = useLogStore((state) => state.selected);
  const loading = useLogStore((state) => state.loading);
  const hasMore = useLogStore((state) => state.hasMore);
  const load = useLogStore((state) => state.load);
  const loadMore = useLogStore((state) => state.loadMore);
  const setFilter = useLogStore((state) => state.setFilter);
  const select = useLogStore((state) => state.select);
  const storedSearch = useLogStore((state) => state.search);
  const applySearch = useLogStore((state) => state.applySearch);
  const clearSearch = useLogStore((state) => state.clearSearch);

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

  const laneCount = rows.reduce(
    (max, row) => Math.max(max, row.lane + 1, row.before.length, row.after.length),
    1,
  );
  const graphWidth = laneCount * LANE_WIDTH + GRAPH_PADDING;

  const visible = rows.slice(range.start, range.end);
  const selectedCommit = selected
    ? (commits.find((commit) => commit.hash === selected) ?? null)
    : null;
  const branchRefs = refs.filter(
    (ref) => ref.name.startsWith("refs/heads/") || ref.name.startsWith("refs/remotes/"),
  );

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
        <span className="muted">
          {commits.length} commits{hasMore ? "+" : ""}
        </span>
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
        direction="horizontal"
        side="end"
        storageKey={LAYOUT_KEYS.historyDetail}
        defaultSize={300}
        min={220}
        max={560}
        label="Resize commit details"
        collapsed={!selectedCommit}
      >
        <div className="history-list-wrap">
          <div className="commit-header" aria-hidden="true">
            <span className="commit-header-graph" style={{ width: graphWidth }}>
              Graph
            </span>
            <span className="commit-header-cell">Description</span>
            <span className="commit-header-cell commit-header-hash">Commit</span>
            <span className="commit-header-cell commit-header-author">Author</span>
            <span className="commit-header-cell commit-header-date">Date</span>
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
                          label: "View diff",
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
                    <span className="commit-refs">{renderRefs(commit.refs)}</span>
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
                    <span className="commit-subject" title={commit.subject}>
                      {commit.subject}
                    </span>
                    <span className="commit-hash">{commit.hash.slice(0, 7)}</span>
                    <span className="commit-author" title={commit.author_name}>
                      {commit.author_name}
                    </span>
                    <span className="commit-date">{formatDateTime(commit.author_time)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {selectedCommit ? (
          <CommitDetail commit={selectedCommit} onClose={() => select(null)} />
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
  if (value === "HEAD") {
    return <span className="ref-badge head">HEAD</span>;
  }
  if (value.startsWith("HEAD -> ")) {
    return <span className="ref-badge head">{value.slice("HEAD -> ".length)}</span>;
  }
  if (value.startsWith("tag: ")) {
    return <span className="ref-badge tag">{value.slice("tag: ".length)}</span>;
  }
  if (value.includes("/")) {
    return <span className="ref-badge remote">{value}</span>;
  }
  return <span className="ref-badge branch">{value}</span>;
}

function CommitDetail({ commit, onClose }: { commit: Commit; onClose: () => void }) {
  const actions = useCommitActions();

  return (
    <aside className="commit-detail" aria-label="Commit details">
      <header>
        <h2>Commit</h2>
        <button type="button" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </header>
      <p className="mono break">{commit.hash}</p>
      <p>
        <strong>{commit.author_name}</strong> &lt;{commit.author_email}&gt;
      </p>
      <p className="muted">{formatDateTime(commit.author_time)}</p>
      <p className="commit-detail-subject">{commit.subject}</p>
      <p className="muted">
        {commit.parents.length} parent(s) · {commit.refs.length} ref(s)
      </p>
      <div className="detail-actions">
        <button
          type="button"
          className="detail-action"
          onClick={() => void actions.showDiff(commit)}
        >
          View diff
        </button>
        <button
          type="button"
          className="detail-action"
          onClick={() => void actions.cherryPick(commit)}
        >
          Cherry-pick
        </button>
        <button type="button" className="detail-action" onClick={() => void actions.revert(commit)}>
          Revert
        </button>
        <button
          type="button"
          className="detail-action danger"
          onClick={() => void actions.reset(commit)}
        >
          Reset to here
        </button>
        <button type="button" className="detail-action" onClick={() => void actions.rebase(commit)}>
          Interactive rebase from here
        </button>
      </div>
    </aside>
  );
}
