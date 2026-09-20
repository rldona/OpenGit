import { useCallback, useEffect, useRef, useState } from "react";
import { confirmDestructive } from "../lib/bridge/dialog";
import { formatDateTime, shortRefName } from "../lib/format";
import { LANE_WIDTH, ROW_HEIGHT } from "../lib/graph/layout";
import { sameRange, visibleRange, type VisibleRange } from "../lib/graph/viewport";
import type { Commit, LogSearch } from "../lib/bridge/types";
import { useRefsStore } from "../lib/stores/refs";
import { useDiffStore } from "../lib/stores/diff";
import { useLogStore } from "../lib/stores/log";
import { useRebaseStore } from "../lib/stores/rebase";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";
import { GraphCanvas } from "./GraphCanvas";

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

      <div className="history-body">
        <div className="history-list-wrap">
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
                    className={`commit-row${selected === row.hash ? " selected" : ""}`}
                    style={{ top: index * ROW_HEIGHT, paddingLeft: graphWidth }}
                    onClick={() => select(row.hash)}
                  >
                    <span className="commit-refs">{renderRefs(commit.refs)}</span>
                    <span className="commit-subject">{commit.subject}</span>
                    <span className="commit-hash">{commit.hash.slice(0, 7)}</span>
                    <span className="commit-author">{commit.author_name}</span>
                    <span className="commit-date">{formatDateTime(commit.author_time)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {selectedCommit && <CommitDetail commit={selectedCommit} onClose={() => select(null)} />}
      </div>
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
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const openCommit = useDiffStore((state) => state.openCommit);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const currentBranch = useRefsStore((state) => state.current);
  const cherryPick = useLogStore((state) => state.cherryPick);
  const revert = useLogStore((state) => state.revert);
  const resetTo = useLogStore((state) => state.resetTo);
  const openRebase = useRebaseStore((state) => state.open);

  const short = commit.hash.slice(0, 7);

  const showDiff = async () => {
    if (!root) {
      return;
    }
    await openCommit(root, commit.hash);
    setActiveView("diff");
  };

  const confirmCherryPick = async () => {
    if (
      root &&
      (await confirmDestructive(`Cherry-pick ${short} onto ${currentBranch ?? "HEAD"}?`))
    ) {
      await cherryPick(root, commit.hash);
    }
  };

  const confirmRevert = async () => {
    if (root && (await confirmDestructive(`Create a revert commit for ${short}?`))) {
      await revert(root, commit.hash);
    }
  };

  const startRebase = async () => {
    if (!root) {
      return;
    }
    await openRebase(root, commit.hash);
    setActiveView("rebase");
  };

  const confirmReset = async () => {
    if (
      root &&
      (await confirmDestructive(
        `Move ${currentBranch ?? "HEAD"} to ${short}? Changes are kept in the working tree, unstaged.`,
      ))
    ) {
      await resetTo(root, commit.hash);
    }
  };

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
        <button type="button" className="detail-action" onClick={() => void showDiff()}>
          View diff
        </button>
        <button type="button" className="detail-action" onClick={() => void confirmCherryPick()}>
          Cherry-pick
        </button>
        <button type="button" className="detail-action" onClick={() => void confirmRevert()}>
          Revert
        </button>
        <button type="button" className="detail-action danger" onClick={() => void confirmReset()}>
          Reset to here
        </button>
        <button type="button" className="detail-action" onClick={() => void startRebase()}>
          Interactive rebase from here
        </button>
      </div>
    </aside>
  );
}
